// multi_token_pallet.rs - simple Substrate pallet skeleton

#![cfg_attr(not(feature = "std"), no_std)]

use frame_support::{dispatch::DispatchResult, pallet_prelude::*};
use frame_system::pallet_prelude::*;

#[derive(Clone, Copy, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo)]
pub enum TokenType {
    Utilitarian,
    Governance,
    Reputation,
}

#[pallet]
pub mod pallet {
    use super::*;

    #[pallet::config]
    pub trait Config: frame_system::Config {}

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::storage]
    pub type Balances<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        Blake2_128Concat,
        TokenType,
        u64,
        ValueQuery,
    >;

    #[pallet::error]
    pub enum Error<T> {
        InsufficientBalance,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        #[pallet::weight(10_000)]
        pub fn mint(
            origin: OriginFor<T>,
            to: T::AccountId,
            token: TokenType,
            amount: u64,
        ) -> DispatchResult {
            ensure_root(origin)?;
            Balances::<T>::mutate(&to, token, |b| *b += amount);
            Ok(())
        }

        #[pallet::weight(10_000)]
        pub fn transfer(
            origin: OriginFor<T>,
            to: T::AccountId,
            token: TokenType,
            amount: u64,
        ) -> DispatchResult {
            let from = ensure_signed(origin)?;
            Balances::<T>::try_mutate(&from, token, |balance| -> DispatchResult {
                ensure!(*balance >= amount, Error::<T>::InsufficientBalance);
                *balance -= amount;
                Ok(())
            })?;
            Balances::<T>::mutate(&to, token, |b| *b += amount);
            Ok(())
        }
    }
}
