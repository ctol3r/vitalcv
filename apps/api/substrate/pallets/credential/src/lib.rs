#![cfg_attr(not(feature = "std"), no_std)]

use frame_support::{dispatch::DispatchResult, pallet_prelude::*};
use frame_system::pallet_prelude::*;
use sp_std::vec::Vec;

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type Event: From<Event<Self>> + IsType<<Self as frame_system::Config>::Event>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::storage]
    #[pallet::getter(fn credentials)]
    pub type Credentials<T: Config> = StorageMap<_, Blake2_128Concat, T::Hash, Credential<T>>;

    #[pallet::storage]
    #[pallet::getter(fn owner_credentials)]
    pub type OwnerCredentials<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, Vec<T::Hash>, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(fn deposit_event)]
    pub enum Event<T: Config> {
        CredentialIssued { id: T::Hash, owner: T::AccountId },
        CredentialUpdated { id: T::Hash },
        CredentialRevoked { id: T::Hash },
    }

    #[pallet::error]
    pub enum Error<T> {
        CredentialNotFound,
        NotCredentialOwner,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        #[pallet::weight(10_000)]
        pub fn issue_credential(
            origin: OriginFor<T>,
            data: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            let credential = Credential { owner: who.clone(), data: data.clone(), revoked: false };
            let id = T::Hashing::hash_of(&credential);
            Credentials::<T>::insert(id, &credential);
            OwnerCredentials::<T>::mutate(&who, |list| list.push(id));
            Self::deposit_event(Event::CredentialIssued { id, owner: who });
            Ok(())
        }

        #[pallet::weight(10_000)]
        pub fn update_credential(
            origin: OriginFor<T>,
            id: T::Hash,
            new_data: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Credentials::<T>::try_mutate(id, |cred| -> DispatchResult {
                let mut credential = cred.as_mut().ok_or(Error::<T>::CredentialNotFound)?;
                ensure!(credential.owner == who, Error::<T>::NotCredentialOwner);
                credential.data = new_data;
                Self::deposit_event(Event::CredentialUpdated { id });
                Ok(())
            })
        }

        #[pallet::weight(10_000)]
        pub fn revoke_credential(
            origin: OriginFor<T>,
            id: T::Hash,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Credentials::<T>::try_mutate(id, |cred| -> DispatchResult {
                let mut credential = cred.as_mut().ok_or(Error::<T>::CredentialNotFound)?;
                ensure!(credential.owner == who, Error::<T>::NotCredentialOwner);
                credential.revoked = true;
                Self::deposit_event(Event::CredentialRevoked { id });
                Ok(())
            })
        }
    }

    #[derive(Encode, Decode, Clone, PartialEq, Eq, TypeInfo, MaxEncodedLen)]
    pub struct Credential<T: Config> {
        pub owner: T::AccountId,
        pub data: Vec<u8>,
        pub revoked: bool,
    }
}
