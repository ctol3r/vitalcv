#![cfg_attr(not(feature = "std"), no_std)]

use frame_support::{dispatch::DispatchResult, pallet_prelude::*};
use frame_system::pallet_prelude::*;
use sp_std::vec::Vec;

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>>
            + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// Max length (bytes) of a subject identifier (e.g., DID hash, NPI hash).
        #[pallet::constant]
        type MaxSubjectIdLen: Get<u32>;

        /// Max number of credentials indexed per subject.
        #[pallet::constant]
        type MaxCredentialsPerSubject: Get<u32>;

        /// Max number of credentials indexed per issuer account.
        #[pallet::constant]
        type MaxCredentialsPerIssuer: Get<u32>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// Credential lifecycle status.
    #[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub enum CredentialStatus {
        Active,
        Revoked,
    }

    pub type SubjectIdOf<T> = BoundedVec<u8, <T as Config>::MaxSubjectIdLen>;

    /// On-chain credential registry record.
    ///
    /// NOTE: Do **not** store raw credential data or PII on-chain. Only store hashes/refs.
    #[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct CredentialRecord<T: Config> {
        /// Issuer account that anchored this credential.
        pub issuer: T::AccountId,
        /// Subject identifier (hashed DID/NPI/etc).
        pub subject: SubjectIdOf<T>,
        /// Hash of VC metadata (32 bytes, off-chain content addressed).
        pub meta_hash: [u8; 32],
        /// Current lifecycle status.
        pub status: CredentialStatus,
        /// Monotonic version counter (incremented on update).
        pub version: u32,
        /// Block number when issued.
        pub issued_at: T::BlockNumber,
        /// Block number of last update (if any).
        pub updated_at: Option<T::BlockNumber>,
        /// Block number of revocation (if revoked).
        pub revoked_at: Option<T::BlockNumber>,
    }

    #[pallet::storage]
    #[pallet::getter(fn credentials)]
    pub type Credentials<T: Config> =
        StorageMap<_, Blake2_128Concat, T::Hash, CredentialRecord<T>, OptionQuery>;

    #[pallet::storage]
    #[pallet::getter(fn subject_credentials)]
    pub type SubjectCredentials<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        SubjectIdOf<T>,
        BoundedVec<T::Hash, <T as Config>::MaxCredentialsPerSubject>,
        ValueQuery,
    >;

    #[pallet::storage]
    #[pallet::getter(fn issuer_credentials)]
    pub type IssuerCredentials<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<T::Hash, <T as Config>::MaxCredentialsPerIssuer>,
        ValueQuery,
    >;

    #[pallet::event]
    #[pallet::generate_deposit(fn deposit_event)]
    pub enum Event<T: Config> {
        /// New credential anchored into the registry.
        CredentialIssued {
            id: T::Hash,
            issuer: T::AccountId,
            subject: Vec<u8>,
            version: u32,
        },
        /// Credential metadata hash updated (version incremented).
        CredentialUpdated { id: T::Hash, issuer: T::AccountId, version: u32 },
        /// Credential revoked.
        CredentialRevoked { id: T::Hash, issuer: T::AccountId },
        BillingRecorded { event_id: Vec<u8>, units: u32, who: T::AccountId },
    }

    #[pallet::error]
    pub enum Error<T> {
        CredentialAlreadyExists,
        CredentialNotFound,
        NotCredentialIssuer,
        InvalidSubjectId,
        InvalidMetaHash,
        CredentialAlreadyRevoked,
        TooManyCredentialsForSubject,
        TooManyCredentialsForIssuer,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Issue (anchor) a credential into the on-chain registry.
        ///
        /// - `id`: A deterministic identifier (e.g., hash of the VC canonical form).
        /// - `subject`: A hashed subject identifier (DID/NPI hash). No PII.
        /// - `meta_hash`: 32-byte hash of off-chain metadata (schema, type, expiry, etc).
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn issue_credential(origin: OriginFor<T>, id: T::Hash, subject: Vec<u8>, meta_hash: Vec<u8>) -> DispatchResult {
            let issuer = ensure_signed(origin)?;

            ensure!(
                !Credentials::<T>::contains_key(id),
                Error::<T>::CredentialAlreadyExists
            );

            let subject_bounded: SubjectIdOf<T> =
                subject.clone().try_into().map_err(|_| Error::<T>::InvalidSubjectId)?;

            ensure!(meta_hash.len() == 32, Error::<T>::InvalidMetaHash);
            let mut meta = [0u8; 32];
            meta.copy_from_slice(&meta_hash[..32]);

            let now = <frame_system::Pallet<T>>::block_number();
            let record = CredentialRecord::<T> {
                issuer: issuer.clone(),
                subject: subject_bounded.clone(),
                meta_hash: meta,
                status: CredentialStatus::Active,
                version: 1,
                issued_at: now,
                updated_at: None,
                revoked_at: None,
            };

            Credentials::<T>::insert(id, &record);

            SubjectCredentials::<T>::try_mutate(subject_bounded, |list| -> DispatchResult {
                list.try_push(id)
                    .map_err(|_| Error::<T>::TooManyCredentialsForSubject)?;
                Ok(())
            })?;

            IssuerCredentials::<T>::try_mutate(&issuer, |list| -> DispatchResult {
                list.try_push(id)
                    .map_err(|_| Error::<T>::TooManyCredentialsForIssuer)?;
                Ok(())
            })?;

            Self::deposit_event(Event::CredentialIssued {
                id,
                issuer,
                subject,
                version: 1,
            });
            Ok(())
        }

        /// Update a credential's metadata hash (version increment).
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn update_credential(origin: OriginFor<T>, id: T::Hash, new_meta_hash: Vec<u8>) -> DispatchResult {
            let issuer = ensure_signed(origin)?;

            ensure!(new_meta_hash.len() == 32, Error::<T>::InvalidMetaHash);
            let mut meta = [0u8; 32];
            meta.copy_from_slice(&new_meta_hash[..32]);

            Credentials::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let record = maybe.as_mut().ok_or(Error::<T>::CredentialNotFound)?;
                ensure!(record.issuer == issuer, Error::<T>::NotCredentialIssuer);
                ensure!(
                    record.status != CredentialStatus::Revoked,
                    Error::<T>::CredentialAlreadyRevoked
                );

                record.meta_hash = meta;
                record.version = record.version.saturating_add(1);
                record.updated_at = Some(<frame_system::Pallet<T>>::block_number());

                Self::deposit_event(Event::CredentialUpdated {
                    id,
                    issuer,
                    version: record.version,
                });
                Ok(())
            })
        }

        /// Revoke a credential.
        #[pallet::call_index(2)]
        #[pallet::weight(10_000)]
        pub fn revoke_credential(origin: OriginFor<T>, id: T::Hash) -> DispatchResult {
            let issuer = ensure_signed(origin)?;
            Credentials::<T>::try_mutate(id, |maybe| -> DispatchResult {
                let record = maybe.as_mut().ok_or(Error::<T>::CredentialNotFound)?;
                ensure!(record.issuer == issuer, Error::<T>::NotCredentialIssuer);
                ensure!(
                    record.status != CredentialStatus::Revoked,
                    Error::<T>::CredentialAlreadyRevoked
                );

                record.status = CredentialStatus::Revoked;
                record.revoked_at = Some(<frame_system::Pallet<T>>::block_number());
                Self::deposit_event(Event::CredentialRevoked { id, issuer });
                Ok(())
            })
        }

        /// Emit a billing event for anchoring/audit purposes.
        ///
        /// Kept here for backward compatibility with existing ledger workflows.
        #[pallet::call_index(3)]
        #[pallet::weight(10_000)]
        pub fn submit_billing_event(
            origin: OriginFor<T>,
            event_id: Vec<u8>,
            units: u32,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            // We just emit the event for anchoring/audit purposes
            Self::deposit_event(Event::BillingRecorded { event_id, units, who });
            Ok(())
        }
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo)]
    pub struct BillingEvent {
        pub event_id: Vec<u8>,
        pub units: u32,
    }
}
