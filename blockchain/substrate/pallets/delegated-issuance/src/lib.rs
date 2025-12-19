#![cfg_attr(not(feature = "std"), no_std)]

use frame_support::{dispatch::DispatchResult, pallet_prelude::*};
use frame_system::pallet_prelude::*;

/// DelegatedIssuance pallet
///
/// Stores issuer -> delegate trust relationships on-chain.
/// This enables a delegate to act on behalf of an issuer (off-chain policy enforcement),
/// while the chain provides an immutable source of truth for active delegations.
#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct Delegation<T: Config> {
        pub issuer: T::AccountId,
        pub delegate: T::AccountId,
        pub created_at: T::BlockNumber,
        pub updated_at: Option<T::BlockNumber>,
        pub expires_at: Option<T::BlockNumber>,
        pub revoked: bool,
    }

    #[pallet::storage]
    #[pallet::getter(fn delegation)]
    /// (issuer, delegate) -> Delegation
    pub type Delegations<T: Config> = StorageDoubleMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        Blake2_128Concat,
        T::AccountId,
        Delegation<T>,
        OptionQuery,
    >;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        DelegateAdded { issuer: T::AccountId, delegate: T::AccountId, expires_at: Option<T::BlockNumber> },
        DelegateUpdated { issuer: T::AccountId, delegate: T::AccountId, expires_at: Option<T::BlockNumber> },
        DelegateRevoked { issuer: T::AccountId, delegate: T::AccountId },
    }

    #[pallet::error]
    pub enum Error<T> {
        DelegationAlreadyExists,
        DelegationNotFound,
        DelegationAlreadyRevoked,
        InvalidExpiry,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Add a delegate for the signing issuer.
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn add_delegate(origin: OriginFor<T>, delegate: T::AccountId, expires_at: Option<T::BlockNumber>) -> DispatchResult {
            let issuer = ensure_signed(origin)?;

            ensure!(
                !Delegations::<T>::contains_key(&issuer, &delegate),
                Error::<T>::DelegationAlreadyExists
            );

            if let Some(exp) = expires_at {
                ensure!(exp > frame_system::Pallet::<T>::block_number(), Error::<T>::InvalidExpiry);
            }

            let now = frame_system::Pallet::<T>::block_number();
            let delegation = Delegation::<T> {
                issuer: issuer.clone(),
                delegate: delegate.clone(),
                created_at: now,
                updated_at: None,
                expires_at,
                revoked: false,
            };

            Delegations::<T>::insert(&issuer, &delegate, &delegation);
            Self::deposit_event(Event::DelegateAdded { issuer, delegate, expires_at });
            Ok(())
        }

        /// Update an existing delegate (e.g., extend/shorten expiry).
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn update_delegate(origin: OriginFor<T>, delegate: T::AccountId, expires_at: Option<T::BlockNumber>) -> DispatchResult {
            let issuer = ensure_signed(origin)?;

            Delegations::<T>::try_mutate(&issuer, &delegate, |maybe| -> DispatchResult {
                let delegation = maybe.as_mut().ok_or(Error::<T>::DelegationNotFound)?;
                ensure!(!delegation.revoked, Error::<T>::DelegationAlreadyRevoked);

                if let Some(exp) = expires_at {
                    ensure!(exp > frame_system::Pallet::<T>::block_number(), Error::<T>::InvalidExpiry);
                }

                delegation.expires_at = expires_at;
                delegation.updated_at = Some(frame_system::Pallet::<T>::block_number());
                Ok(())
            })?;

            Self::deposit_event(Event::DelegateUpdated { issuer, delegate, expires_at });
            Ok(())
        }

        /// Revoke a delegate.
        #[pallet::call_index(2)]
        #[pallet::weight(10_000)]
        pub fn revoke_delegate(origin: OriginFor<T>, delegate: T::AccountId) -> DispatchResult {
            let issuer = ensure_signed(origin)?;
            Delegations::<T>::try_mutate(&issuer, &delegate, |maybe| -> DispatchResult {
                let delegation = maybe.as_mut().ok_or(Error::<T>::DelegationNotFound)?;
                ensure!(!delegation.revoked, Error::<T>::DelegationAlreadyRevoked);
                delegation.revoked = true;
                delegation.updated_at = Some(frame_system::Pallet::<T>::block_number());
                Ok(())
            })?;

            Self::deposit_event(Event::DelegateRevoked { issuer, delegate });
            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// Helper for off-chain clients: is the delegation active now?
        pub fn is_active(issuer: &T::AccountId, delegate: &T::AccountId) -> bool {
            let Some(d) = Delegations::<T>::get(issuer, delegate) else { return false };
            if d.revoked {
                return false;
            }
            let now = frame_system::Pallet::<T>::block_number();
            if let Some(exp) = d.expires_at {
                if exp <= now {
                    return false;
                }
            }
            true
        }
    }
}

