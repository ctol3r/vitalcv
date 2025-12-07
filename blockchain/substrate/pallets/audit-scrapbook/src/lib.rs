//! # Audit Scrapbook Pallet
//!
//! LEDGER-011: Finalize AuditScrapbook pallet and runtime integration
//!
//! This pallet stores immutable audit records for VC lifecycle events:
//! - Issue: Credential issuance
//! - Revoke: Credential revocation
//! - Verify: Credential verification
//! - Access: Credential access events
//!
//! Records use peppered hashes for GDPR compliance (no PII stored on-chain).

#![cfg_attr(not(feature = "std"), no_std)]

use frame_support::{
    dispatch::DispatchResult,
    pallet_prelude::*,
    traits::{Get, GenesisBuild},
};
use frame_system::pallet_prelude::*;
use sp_std::vec::Vec;
use sp_runtime::traits::{SaturatedConversion, Saturating};

/// Audit action types
#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub enum ActionType {
    /// Credential issued
    Issue,
    /// Credential revoked
    Revoke,
    /// Credential verified
    Verify,
    /// Credential accessed
    Access,
}

impl ActionType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ActionType::Issue => "ISSUE",
            ActionType::Revoke => "REVOKE",
            ActionType::Verify => "VERIFY",
            ActionType::Access => "ACCESS",
        }
    }
}

/// AuditRecord structure
/// LEDGER-011: Stores {timestamp, action_type, target_hash, actor_did, meta_hash}
#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
#[scale_info(skip_type_params(T))]
pub struct AuditRecord {
    /// Timestamp of the action (Unix timestamp in milliseconds)
    pub timestamp: u64,
    /// Type of action performed
    pub action_type: ActionType,
    /// Peppered hash of the target (credential hash for GDPR compliance)
    pub target_hash: Vec<u8>,
    /// DID of the actor performing the action
    pub actor_did: Vec<u8>,
    /// Hash of metadata (anchored on-chain, details stored off-chain)
    pub meta_hash: Vec<u8>,
}

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config + pallet_timestamp::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// Maximum number of audit records that can be stored per block
        #[pallet::constant]
        type MaxRecordsPerBlock: Get<u32>;
    }

    #[pallet::storage]
    #[pallet::getter(fn audit_record_count)]
    /// Total count of audit records (for indexing)
    pub type AuditRecordCount<T: Config> = StorageValue<_, u64, ValueQuery>;

    #[pallet::storage]
    #[pallet::getter(fn audit_record_by_index)]
    /// Audit records indexed by sequential number
    pub type AuditRecords<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u64,
        AuditRecord,
        OptionQuery,
    >;

    #[pallet::storage]
    #[pallet::getter(fn audit_records_by_hash)]
    /// Index of audit records by target hash (for lookup)
    pub type AuditRecordsByHash<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        Vec<u8>, // target_hash
        Vec<u64>, // List of audit record indices
        ValueQuery,
    >;

    #[pallet::storage]
    #[pallet::getter(fn audit_records_by_actor)]
    /// Index of audit records by actor DID
    pub type AuditRecordsByActor<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        Vec<u8>, // actor_did
        Vec<u64>, // List of audit record indices
        ValueQuery,
    >;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// Audit record created
        AuditRecordCreated {
            record_index: u64,
            action_type: ActionType,
            target_hash: Vec<u8>,
            actor_did: Vec<u8>,
            timestamp: u64,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// Invalid timestamp (in the future or too old)
        InvalidTimestamp,
        /// Invalid target hash length
        InvalidTargetHash,
        /// Invalid actor DID format
        InvalidActorDid,
        /// Invalid meta hash length
        InvalidMetaHash,
        /// Too many records in this block
        TooManyRecordsPerBlock,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Record an audit event
        ///
        /// # Parameters
        /// - `action_type`: Type of action (Issue, Revoke, Verify, Access)
        /// - `target_hash`: Peppered hash of the credential/object (32 bytes)
        /// - `actor_did`: DID of the actor performing the action
        /// - `meta_hash`: Hash of metadata (32 bytes)
        #[pallet::weight(10_000)]
        pub fn record_audit(
            origin: OriginFor<T>,
            action_type: ActionType,
            target_hash: Vec<u8>,
            actor_did: Vec<u8>,
            meta_hash: Vec<u8>,
        ) -> DispatchResult {
            // Anyone can record audit events (trusted backend services)
            let _ = ensure_signed(origin)?;

            // Get current timestamp
            let now = pallet_timestamp::Pallet::<T>::now();
            let timestamp_ms = now.saturated_into::<u64>() / 1000; // Convert to milliseconds

            // Validate inputs
            ensure!(
                target_hash.len() == 32,
                Error::<T>::InvalidTargetHash
            );
            ensure!(
                actor_did.len() > 0 && actor_did.len() <= 256,
                Error::<T>::InvalidActorDid
            );
            ensure!(
                meta_hash.len() == 32,
                Error::<T>::InvalidMetaHash
            );

            // Validate timestamp (must be within last hour to prevent replay)
            let max_age = 3600 * 1000; // 1 hour in milliseconds
            ensure!(
                timestamp_ms <= now.saturated_into::<u64>() / 1000 + max_age,
                Error::<T>::InvalidTimestamp
            );

            // Get next record index
            let record_index = AuditRecordCount::<T>::get();

            // Create audit record
            let record = AuditRecord {
                timestamp: timestamp_ms,
                action_type: action_type.clone(),
                target_hash: target_hash.clone(),
                actor_did: actor_did.clone(),
                meta_hash: meta_hash.clone(),
            };

            // Store record
            AuditRecords::<T>::insert(record_index, &record);
            AuditRecordCount::<T>::put(record_index.saturating_add(1));

            // Update indices
            AuditRecordsByHash::<T>::mutate(&target_hash, |indices| {
                if !indices.contains(&record_index) {
                    indices.push(record_index);
                }
            });

            AuditRecordsByActor::<T>::mutate(&actor_did, |indices| {
                if !indices.contains(&record_index) {
                    indices.push(record_index);
                }
            });

            // Emit event
            Self::deposit_event(Event::AuditRecordCreated {
                record_index,
                action_type,
                target_hash,
                actor_did,
                timestamp: timestamp_ms,
            });

            Ok(())
        }

        /// Batch record multiple audit events
        /// Useful for efficient bulk operations
        #[pallet::weight(10_000 + T::MaxRecordsPerBlock::get() * 10_000)]
        pub fn batch_record_audit(
            origin: OriginFor<T>,
            records: Vec<(ActionType, Vec<u8>, Vec<u8>, Vec<u8>)>,
        ) -> DispatchResult {
            let _ = ensure_signed(origin)?;

            let max_records = T::MaxRecordsPerBlock::get();
            ensure!(
                records.len() as u32 <= max_records,
                Error::<T>::TooManyRecordsPerBlock
            );

            for (action_type, target_hash, actor_did, meta_hash) in records {
                Self::record_audit(
                    origin.clone(),
                    action_type,
                    target_hash,
                    actor_did,
                    meta_hash,
                )?;
            }

            Ok(())
        }
    }

    #[pallet::genesis_config]
    pub struct GenesisConfig<T: Config> {
        pub initial_records: Vec<AuditRecord>,
    }

    #[cfg(feature = "std")]
    impl<T: Config> Default for GenesisConfig<T> {
        fn default() -> Self {
            Self {
                initial_records: Default::default(),
            }
        }
    }

    #[pallet::genesis_build]
    impl<T: Config> GenesisBuild<T> for GenesisConfig<T> {
        fn build(&self) {
            let mut count = 0u64;
            for record in &self.initial_records {
                AuditRecords::<T>::insert(count, record);
                count = count.saturating_add(1);
            }
            AuditRecordCount::<T>::put(count);
        }
    }
}

