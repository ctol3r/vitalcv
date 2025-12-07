#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{pallet_prelude::*, dispatch::DispatchResultWithPostInfo};
    use frame_system::pallet_prelude::*;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
    }

    #[pallet::storage]
    #[pallet::getter(fn proofs)]
    pub type Proofs<T: Config> = StorageMap<_, Blake2_128Concat, T::Hash, (T::AccountId, BlockNumberFor<T>)>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        ClaimCreated(T::AccountId, T::Hash),
        ClaimRevoked(T::AccountId, T::Hash),
    }

    #[pallet::error]
    pub enum Error<T> {
        ProofAlreadyExists,
        ClaimNotExist,
        NotClaimOwner,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        #[pallet::weight(10_000)]
        pub fn create_claim(origin: OriginFor<T>, proof: T::Hash) -> DispatchResultWithPostInfo {
            let sender = ensure_signed(origin)?;

            ensure!(!Proofs::<T>::contains_key(&proof), Error::<T>::ProofAlreadyExists);

            Proofs::<T>::insert(&proof, (&sender, <frame_system::Pallet<T>>::block_number()));

            Self::deposit_event(Event::ClaimCreated(sender, proof));
            Ok(().into())
        }

        #[pallet::weight(10_000)]
        pub fn revoke_claim(origin: OriginFor<T>, proof: T::Hash) -> DispatchResultWithPostInfo {
            let sender = ensure_signed(origin)?;

            let (owner, _) = Proofs::<T>::get(&proof).ok_or(Error::<T>::ClaimNotExist)?;

            ensure!(owner == sender, Error::<T>::NotClaimOwner);

            Proofs::<T>::remove(&proof);

            Self::deposit_event(Event::ClaimRevoked(sender, proof));
            Ok(().into())
        }
    }
}
