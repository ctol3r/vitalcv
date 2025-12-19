#![cfg_attr(not(feature = "std"), no_std)]

use frame_support::{dispatch::DispatchResult, pallet_prelude::*};
use frame_system::pallet_prelude::*;

/// StatusListBitstring pallet
///
/// Implements a compact on-chain revocation status list using a bitmap stored in `u64` chunks.
/// Bit `1` indicates revoked.
#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// Max number of updates in a single batch call.
        #[pallet::constant]
        type MaxBatchUpdates: Get<u32>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct StatusListMeta<T: Config> {
        pub owner: T::AccountId,
        /// Total number of bits in the list.
        pub size: u32,
        pub created_at: T::BlockNumber,
        pub updated_at: Option<T::BlockNumber>,
    }

    #[pallet::storage]
    #[pallet::getter(fn list_meta)]
    pub type Lists<T: Config> =
        StorageMap<_, Blake2_128Concat, T::Hash, StatusListMeta<T>, OptionQuery>;

    #[pallet::storage]
    #[pallet::getter(fn bit_chunk)]
    /// (list_id, chunk_index) -> u64 chunk
    pub type Chunks<T: Config> =
        StorageDoubleMap<_, Blake2_128Concat, T::Hash, Blake2_128Concat, u32, u64, ValueQuery>;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        StatusListCreated { list_id: T::Hash, owner: T::AccountId, size: u32 },
        StatusBitSet { list_id: T::Hash, index: u32, revoked: bool },
        StatusBitsBatchSet { list_id: T::Hash, count: u32 },
    }

    #[pallet::error]
    pub enum Error<T> {
        ListAlreadyExists,
        ListNotFound,
        NotListOwner,
        IndexOutOfBounds,
        TooManyBatchUpdates,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Create a new status list.
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn create_list(origin: OriginFor<T>, list_id: T::Hash, size: u32) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(!Lists::<T>::contains_key(&list_id), Error::<T>::ListAlreadyExists);

            let now = frame_system::Pallet::<T>::block_number();
            Lists::<T>::insert(
                &list_id,
                StatusListMeta::<T> {
                    owner: who.clone(),
                    size,
                    created_at: now,
                    updated_at: None,
                },
            );

            Self::deposit_event(Event::StatusListCreated { list_id, owner: who, size });
            Ok(())
        }

        /// Set a single status bit.
        #[pallet::call_index(1)]
        #[pallet::weight(10_000)]
        pub fn set_status(origin: OriginFor<T>, list_id: T::Hash, index: u32, revoked: bool) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Lists::<T>::try_mutate(&list_id, |maybe| -> DispatchResult {
                let meta = maybe.as_mut().ok_or(Error::<T>::ListNotFound)?;
                ensure!(meta.owner == who, Error::<T>::NotListOwner);
                ensure!(index < meta.size, Error::<T>::IndexOutOfBounds);

                Self::set_bit(&list_id, index, revoked);
                meta.updated_at = Some(frame_system::Pallet::<T>::block_number());
                Ok(())
            })?;

            Self::deposit_event(Event::StatusBitSet { list_id, index, revoked });
            Ok(())
        }

        /// Batch set multiple status bits.
        #[pallet::call_index(2)]
        #[pallet::weight(10_000)]
        pub fn batch_set_status(origin: OriginFor<T>, list_id: T::Hash, updates: Vec<(u32, bool)>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            ensure!(
                (updates.len() as u32) <= T::MaxBatchUpdates::get(),
                Error::<T>::TooManyBatchUpdates
            );

            Lists::<T>::try_mutate(&list_id, |maybe| -> DispatchResult {
                let meta = maybe.as_mut().ok_or(Error::<T>::ListNotFound)?;
                ensure!(meta.owner == who, Error::<T>::NotListOwner);

                for (index, revoked) in &updates {
                    ensure!(*index < meta.size, Error::<T>::IndexOutOfBounds);
                    Self::set_bit(&list_id, *index, *revoked);
                }

                meta.updated_at = Some(frame_system::Pallet::<T>::block_number());
                Ok(())
            })?;

            Self::deposit_event(Event::StatusBitsBatchSet { list_id, count: updates.len() as u32 });
            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// Read-only helper: check whether `index` is revoked.
        pub fn is_revoked(list_id: &T::Hash, index: u32) -> Result<bool, Error<T>> {
            let Some(meta) = Lists::<T>::get(list_id) else { return Err(Error::<T>::ListNotFound) };
            ensure!(index < meta.size, Error::<T>::IndexOutOfBounds);
            Ok(Self::get_bit(list_id, index))
        }

        fn get_bit(list_id: &T::Hash, index: u32) -> bool {
            let (chunk, bit) = Self::chunk_and_bit(index);
            let value = Chunks::<T>::get(list_id, chunk);
            ((value >> bit) & 1) == 1
        }

        fn set_bit(list_id: &T::Hash, index: u32, revoked: bool) {
            let (chunk, bit) = Self::chunk_and_bit(index);
            Chunks::<T>::mutate(list_id, chunk, |value| {
                if revoked {
                    *value |= 1u64 << bit;
                } else {
                    *value &= !(1u64 << bit);
                }
            });
        }

        #[inline]
        fn chunk_and_bit(index: u32) -> (u32, u32) {
            (index / 64, index % 64)
        }
    }
}

