#![cfg_attr(not(feature = "std"), no_std)]

use frame_support::{dispatch::DispatchResult, pallet_prelude::*};
use frame_system::pallet_prelude::*;
use sp_std::vec::Vec;

/// IdentityBinding pallet
///
/// Binds a provider DID (or hashed DID) to an NPI hash (32 bytes).
/// Stores only hashed identifiers (no PII) and emits events for updates/rotations.
#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// Max bytes allowed for a DID string (or DID hash bytes).
        #[pallet::constant]
        type MaxDidLen: Get<u32>;

        /// Max number of DID rotations stored per NPI.
        #[pallet::constant]
        type MaxRotationsPerNpi: Get<u32>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    pub type DidOf<T> = BoundedVec<u8, <T as Config>::MaxDidLen>;
    pub type NpiHash = [u8; 32];

    #[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct Binding<T: Config> {
        pub controller: T::AccountId,
        pub npi_hash: NpiHash,
        pub created_at: T::BlockNumber,
        pub updated_at: Option<T::BlockNumber>,
        pub rotated_from: Option<DidOf<T>>,
    }

    #[pallet::storage]
    #[pallet::getter(fn did_binding)]
    /// DID -> Binding
    pub type DidBindings<T: Config> =
        StorageMap<_, Blake2_128Concat, DidOf<T>, Binding<T>, OptionQuery>;

    #[pallet::storage]
    #[pallet::getter(fn npi_current_did)]
    /// NPI hash -> current DID
    pub type NpiToDid<T: Config> =
        StorageMap<_, Blake2_128Concat, NpiHash, DidOf<T>, OptionQuery>;

    #[pallet::storage]
    #[pallet::getter(fn npi_rotation_history)]
    /// NPI hash -> historical DIDs (oldest -> newest, excluding current)
    pub type NpiRotationHistory<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        NpiHash,
        BoundedVec<DidOf<T>, <T as Config>::MaxRotationsPerNpi>,
        ValueQuery,
    >;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        IdentityBound { did: Vec<u8>, npi_hash: NpiHash, controller: T::AccountId },
        IdentityUpdated { did: Vec<u8>, old_npi_hash: NpiHash, new_npi_hash: NpiHash, controller: T::AccountId },
        DidRotated { old_did: Vec<u8>, new_did: Vec<u8>, npi_hash: NpiHash, controller: T::AccountId },
    }

    #[pallet::error]
    pub enum Error<T> {
        InvalidDid,
        DidAlreadyBound,
        NpiAlreadyBound,
        BindingNotFound,
        NotController,
        TooManyRotations,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Create an initial binding of DID -> NPI hash.
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn bind_identity(origin: OriginFor<T>, did: Vec<u8>, npi_hash: NpiHash) -> DispatchResult {
            let who = ensure_signed(origin)?;

            ensure!(!did.is_empty(), Error::<T>::InvalidDid);
            let did_bounded: DidOf<T> = did.clone().try_into().map_err(|_| Error::<T>::InvalidDid)?;

            ensure!(!DidBindings::<T>::contains_key(&did_bounded), Error::<T>::DidAlreadyBound);
            ensure!(!NpiToDid::<T>::contains_key(&npi_hash), Error::<T>::NpiAlreadyBound);

            let now = frame_system::Pallet::<T>::block_number();
            let binding = Binding::<T> {
                controller: who.clone(),
                npi_hash,
                created_at: now,
                updated_at: None,
                rotated_from: None,
            };

            DidBindings::<T>::insert(&did_bounded, &binding);
            NpiToDid::<T>::insert(npi_hash, &did_bounded);

            Self::deposit_event(Event::IdentityBound { did, npi_hash, controller: who });
            Ok(())
        }

        /// Update the NPI hash associated with an existing DID binding.
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn update_binding(origin: OriginFor<T>, did: Vec<u8>, new_npi_hash: NpiHash) -> DispatchResult {
            let who = ensure_signed(origin)?;

            ensure!(!did.is_empty(), Error::<T>::InvalidDid);
            let did_bounded: DidOf<T> = did.clone().try_into().map_err(|_| Error::<T>::InvalidDid)?;

            DidBindings::<T>::try_mutate(&did_bounded, |maybe| -> DispatchResult {
                let binding = maybe.as_mut().ok_or(Error::<T>::BindingNotFound)?;
                ensure!(binding.controller == who, Error::<T>::NotController);

                let old_npi_hash = binding.npi_hash;
                if old_npi_hash != new_npi_hash {
                    // Prevent stealing an existing NPI binding.
                    if let Some(existing_did) = NpiToDid::<T>::get(&new_npi_hash) {
                        ensure!(existing_did == did_bounded, Error::<T>::NpiAlreadyBound);
                    }

                    // Update reverse index
                    NpiToDid::<T>::remove(&old_npi_hash);
                    NpiToDid::<T>::insert(new_npi_hash, &did_bounded);

                    binding.npi_hash = new_npi_hash;
                }

                binding.updated_at = Some(frame_system::Pallet::<T>::block_number());
                Self::deposit_event(Event::IdentityUpdated {
                    did,
                    old_npi_hash,
                    new_npi_hash,
                    controller: who,
                });
                Ok(())
            })
        }

        /// Rotate DID for a given binding (keeps the same NPI hash).
        #[pallet::call_index(2)]
        #[pallet::weight(10_000)]
        pub fn rotate_did(origin: OriginFor<T>, old_did: Vec<u8>, new_did: Vec<u8>) -> DispatchResult {
            let who = ensure_signed(origin)?;

            ensure!(!old_did.is_empty() && !new_did.is_empty(), Error::<T>::InvalidDid);
            let old_bounded: DidOf<T> = old_did.clone().try_into().map_err(|_| Error::<T>::InvalidDid)?;
            let new_bounded: DidOf<T> = new_did.clone().try_into().map_err(|_| Error::<T>::InvalidDid)?;

            ensure!(!DidBindings::<T>::contains_key(&new_bounded), Error::<T>::DidAlreadyBound);

            let old_binding = DidBindings::<T>::get(&old_bounded).ok_or(Error::<T>::BindingNotFound)?;
            ensure!(old_binding.controller == who, Error::<T>::NotController);

            let npi_hash = old_binding.npi_hash;

            // Append old DID to rotation history.
            NpiRotationHistory::<T>::try_mutate(npi_hash, |hist| -> DispatchResult {
                hist.try_push(old_bounded.clone())
                    .map_err(|_| Error::<T>::TooManyRotations)?;
                Ok(())
            })?;

            // Remove old mapping and insert new mapping.
            DidBindings::<T>::remove(&old_bounded);
            let now = frame_system::Pallet::<T>::block_number();
            let new_binding = Binding::<T> {
                controller: old_binding.controller.clone(),
                npi_hash,
                created_at: old_binding.created_at,
                updated_at: Some(now),
                rotated_from: Some(old_bounded.clone()),
            };

            DidBindings::<T>::insert(&new_bounded, &new_binding);
            NpiToDid::<T>::insert(npi_hash, &new_bounded);

            Self::deposit_event(Event::DidRotated { old_did: old_did, new_did, npi_hash, controller: who });
            Ok(())
        }
    }
}

