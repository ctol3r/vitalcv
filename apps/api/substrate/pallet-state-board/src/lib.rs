#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{dispatch::DispatchResult, pallet_prelude::*};
    use frame_system::offchain::SubmitTransaction;
    use frame_system::pallet_prelude::*;
    use sp_runtime::offchain as rt_offchain;
    use sp_std::vec::Vec;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        /// The overarching call type.
        type Call: From<Call<Self>>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// New board data synced.
        BoardSynced(Vec<u8>),
    }

    #[pallet::error]
    pub enum Error<T> {
        HttpFetchingError,
    }

    #[pallet::storage]
    #[pallet::getter(fn board_data)]
    pub type BoardData<T: Config> = StorageValue<_, Vec<u8>, ValueQuery>;

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        #[pallet::call_index(0)]
        #[pallet::weight(10_000)]
        pub fn submit_data(origin: OriginFor<T>, data: Vec<u8>) -> DispatchResult {
            let _ = ensure_signed(origin)?;
            <BoardData<T>>::put(&data);
            Self::deposit_event(Event::BoardSynced(data));
            Ok(())
        }
    }

    #[pallet::hooks]
    impl<T: Config> Hooks<BlockNumberFor<T>> for Pallet<T> {
        fn offchain_worker(block_number: BlockNumberFor<T>) {
            if let Err(e) = Self::sync_board_data(block_number) {
                log::error!(target: "state_board", "offchain worker error: {:?}", e);
            }
        }
    }

    impl<T: Config> Pallet<T> {
        fn sync_board_data(_block: BlockNumberFor<T>) -> Result<(), Error<T>> {
            let url = "https://example.com/state-board";
            let request = rt_offchain::http::Request::get(url);
            let timeout =
                sp_io::offchain::timestamp().add(rt_offchain::Duration::from_millis(3_000));
            let pending = request
                .deadline(timeout)
                .send()
                .map_err(|_| Error::<T>::HttpFetchingError)?;
            let response = pending
                .wait(timeout)
                .map_err(|_| Error::<T>::HttpFetchingError)?;
            if response.code != 200 {
                log::warn!("Unexpected status code: {}", response.code);
                return Err(Error::<T>::HttpFetchingError);
            }
            let body = response.body().collect::<Vec<u8>>();
            // Submit extrinsic with fetched data
            let call = Call::submit_data { data: body.clone() };
            SubmitTransaction::<T, Call<T>>::submit_unsigned_transaction(call.into())
                .map_err(|_| Error::<T>::HttpFetchingError)?;
            Ok(())
        }
    }
}
