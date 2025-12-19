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
    traits::Get,
};
use frame_system::pallet_prelude::*;
use sp_std::vec::Vec;
use sp_runtime::traits::SaturatedConversion;

/// Audit action types
#[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
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

        /// Max DID bytes for actor identifiers.
        #[pallet::constant]
        type MaxActorDidLen: Get<u32>;

        /// Max number of record indices stored per target hash.
        #[pallet::constant]
        type MaxRecordsPerTarget: Get<u32>;

        /// Max number of record indices stored per actor DID.
        #[pallet::constant]
        type MaxRecordsPerActor: Get<u32>;
    }

    pub type TargetHash = [u8; 32];
    pub type MetaHash = [u8; 32];
    pub type ActorDidOf<T> = BoundedVec<u8, <T as Config>::MaxActorDidLen>;
    pub type RecordIdxListByTarget<T> = BoundedVec<u64, <T as Config>::MaxRecordsPerTarget>;
    pub type RecordIdxListByActor<T> = BoundedVec<u64, <T as Config>::MaxRecordsPerActor>;

    /// AuditRecord structure
    /// Stores {timestamp, action_type, target_hash, actor_did, meta_hash, block_number, extrinsic_index}
    #[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct AuditRecord<T: Config> {
        /// Timestamp of the action (Unix timestamp in milliseconds)
        pub timestamp: u64,
        /// Type of action performed
        pub action_type: ActionType,
        /// Peppered hash of the target (credential hash for GDPR compliance)
        pub target_hash: TargetHash,
        /// DID of the actor performing the action
        pub actor_did: ActorDidOf<T>,
        /// Hash of metadata (anchored on-chain, details stored off-chain)
        pub meta_hash: MetaHash,
        /// Block number where this record was created.
        pub block_number: T::BlockNumber,
        /// Extrinsic index within the block (if available).
        pub extrinsic_index: Option<u32>,
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
        AuditRecord<T>,
        OptionQuery,
    >;

    #[pallet::storage]
    #[pallet::getter(fn audit_records_by_hash)]
    /// Index of audit records by target hash (for lookup)
    pub type AuditRecordsByHash<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        TargetHash,
        RecordIdxListByTarget<T>,
        ValueQuery,
    >;

    #[pallet::storage]
    #[pallet::getter(fn audit_records_by_actor)]
    /// Index of audit records by actor DID
    pub type AuditRecordsByActor<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        ActorDidOf<T>,
        RecordIdxListByActor<T>,
        ValueQuery,
    >;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// Audit record created
        AuditRecordCreated {
            record_index: u64,
            action_type: ActionType,
            target_hash: TargetHash,
            actor_did: Vec<u8>,
            timestamp: u64,
            block_number: T::BlockNumber,
            extrinsic_index: Option<u32>,
        },
    }

    #[pallet::error]
    pub enum Error<T> {
        /// Invalid timestamp (in the future or too old)
        InvalidTimestamp,
        /// Invalid actor DID format
        InvalidActorDid,
        /// Too many records in this block
        TooManyRecordsPerBlock,
        /// Too many indices stored for this target hash.
        TooManyRecordsForTarget,
        /// Too many indices stored for this actor DID.
        TooManyRecordsForActor,
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
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn record_audit(
            origin: OriginFor<T>,
            action_type: ActionType,
            target_hash: TargetHash,
            actor_did: Vec<u8>,
            meta_hash: MetaHash,
        ) -> DispatchResult {
            // Anyone can record audit events (trusted backend services)
            let _ = ensure_signed(origin)?;
            Self::do_record_audit(action_type, target_hash, actor_did, meta_hash)
        }

        /// Batch record multiple audit events
        /// Useful for efficient bulk operations
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn batch_record_audit(
            origin: OriginFor<T>,
            records: Vec<(ActionType, TargetHash, Vec<u8>, MetaHash)>,
        ) -> DispatchResult {
            let _ = ensure_signed(origin)?;

            let max_records = T::MaxRecordsPerBlock::get();
            ensure!(
                records.len() as u32 <= max_records,
                Error::<T>::TooManyRecordsPerBlock
            );

            for (action_type, target_hash, actor_did, meta_hash) in records {
                Self::do_record_audit(action_type, target_hash, actor_did, meta_hash)?;
            }

            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        fn do_record_audit(
            action_type: ActionType,
            target_hash: TargetHash,
            actor_did: Vec<u8>,
            meta_hash: MetaHash,
        ) -> DispatchResult {
            // Timestamp (ms since epoch) from on-chain timestamp pallet.
            let now = pallet_timestamp::Pallet::<T>::now();
            let timestamp_ms = now.saturated_into::<u64>();

            // Validate + bound actor DID.
            ensure!(
                !actor_did.is_empty() && (actor_did.len() as u32) <= T::MaxActorDidLen::get(),
                Error::<T>::InvalidActorDid
            );
            let actor_bounded: ActorDidOf<T> =
                actor_did.clone().try_into().map_err(|_| Error::<T>::InvalidActorDid)?;

            // Get next record index
            let record_index = AuditRecordCount::<T>::get();

            let block_number = <frame_system::Pallet<T>>::block_number();
            let extrinsic_index = <frame_system::Pallet<T>>::extrinsic_index();

            // Create audit record
            let record = AuditRecord::<T> {
                timestamp: timestamp_ms,
                action_type: action_type.clone(),
                target_hash,
                actor_did: actor_bounded.clone(),
                meta_hash,
                block_number,
                extrinsic_index,
            };

            // Store record + bump counter
            AuditRecords::<T>::insert(record_index, &record);
            AuditRecordCount::<T>::put(record_index.saturating_add(1));

            // Update indices (bounded)
            AuditRecordsByHash::<T>::try_mutate(target_hash, |indices| -> DispatchResult {
                if !indices.contains(&record_index) {
                    indices
                        .try_push(record_index)
                        .map_err(|_| Error::<T>::TooManyRecordsForTarget)?;
                }
                Ok(())
            })?;

            AuditRecordsByActor::<T>::try_mutate(actor_bounded, |indices| -> DispatchResult {
                if !indices.contains(&record_index) {
                    indices
                        .try_push(record_index)
                        .map_err(|_| Error::<T>::TooManyRecordsForActor)?;
                }
                Ok(())
            })?;

            // Emit event
            Self::deposit_event(Event::AuditRecordCreated {
                record_index,
                action_type,
                target_hash,
                actor_did,
                timestamp: timestamp_ms,
                block_number,
                extrinsic_index,
            });

            Ok(())
        }
    }
}

