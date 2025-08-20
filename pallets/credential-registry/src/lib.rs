#![cfg_attr(not(feature = "std"), no_std)]

use frame_support::{dispatch::DispatchResult, pallet_prelude::*};
use frame_system::pallet_prelude::*;
use sp_std::vec::Vec;

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type Event: From<Event<Self>> + IsType<<Self as frame_system::Config>::Event>;
    }

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        CredentialStored { hash: Vec<u8>, issuer: Vec<u8> },
    }

    #[pallet::storage]
    #[pallet::getter(fn credential_by_hash)]
    pub type CredentialRegistry<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        Vec<u8>, // Credential hash
        Vec<u8>, // Issuer DID
        OptionQuery,
    >;

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        #[pallet::weight(10_000)]
        pub fn store_credential(
            origin: OriginFor<T>,
            hash: Vec<u8>,
            issuer: Vec<u8>,
        ) -> DispatchResult {
            ensure_signed(origin)?;
            <CredentialRegistry<T>>::insert(&hash, &issuer);
            Self::deposit_event(Event::CredentialStored { hash, issuer });
            Ok(())
        }
    }
}

