#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

use alloc::collections::BTreeMap;

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct StatusEntry {
    pub revoked: bool,
    pub expiry_at: Option<u64>,
    pub updated_at: u64,
}

#[derive(Default)]
pub struct StatusList {
    entries: BTreeMap<u32, StatusEntry>,
}

impl StatusList {
    pub fn mark_revoked(&mut self, index: u32, expires_at: Option<u64>, now: u64) {
        let entry = self.entries.entry(index).or_insert_with(StatusEntry::default);
        entry.revoked = true;
        entry.expiry_at = expires_at;
        entry.updated_at = now;
    }

    pub fn mark_valid(&mut self, index: u32, expires_at: Option<u64>, now: u64) {
        let entry = self.entries.entry(index).or_insert_with(StatusEntry::default);
        entry.revoked = false;
        entry.expiry_at = expires_at;
        entry.updated_at = now;
    }

    pub fn is_revoked(&self, index: u32) -> bool {
        self.entries.get(&index).map(|entry| entry.revoked).unwrap_or(false)
    }

    pub fn expire_entries(&mut self, now: u64) -> usize {
        let mut expired = 0;
        for entry in self.entries.values_mut() {
            if entry.revoked {
                continue;
            }
            if let Some(expiry_at) = entry.expiry_at {
                if expiry_at <= now {
                    entry.revoked = true;
                    entry.updated_at = now;
                    expired += 1;
                }
            }
        }
        expired
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expired_entries_are_revoked() {
        let mut list = StatusList::default();
        list.mark_valid(10, Some(100), 0);
        assert_eq!(list.expire_entries(150), 1);
        assert!(list.is_revoked(10));
    }

    #[test]
    fn manual_revocation_not_reverted_by_expiry() {
        let mut list = StatusList::default();
        list.mark_revoked(5, Some(100), 10);
        assert_eq!(list.expire_entries(150), 0);
        assert!(list.is_revoked(5));
    }

    #[test]
    fn newest_update_wins_for_same_index() {
        let mut list = StatusList::default();
        list.mark_valid(1, Some(200), 0);
        list.mark_revoked(1, Some(250), 50);
        list.mark_valid(1, Some(300), 60);

        assert!(!list.is_revoked(1));
        assert_eq!(list.len(), 1);
    }
}
#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

use frame_support::pallet_prelude::*;
use frame_system::pallet_prelude::*;

#[frame_support::pallet]
pub mod pallet {
  use super::*;

  #[pallet::config]
  pub trait Config: frame_system::Config {
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

    #[pallet::constant]
    type StatusesPerPage: Get<u32>;

    #[pallet::constant]
    type MaxStatuses: Get<u32>;

    #[pallet::constant]
    type MaxPageBytes: Get<u32>;

    type StatusUpdateOrigin: EnsureOrigin<Self::RuntimeOrigin>;
  }

  #[pallet::storage]
  #[pallet::getter(fn status_pages)]
  pub type StatusPages<T: Config> =
    StorageMap<_, Blake2_128Concat, u32, BoundedVec<u8, T::MaxPageBytes>, ValueQuery>;

  #[pallet::event]
  #[pallet::generate_deposit(pub(super) fn deposit_event)]
  pub enum Event<T: Config> {
    StatusUpdated { index: u32, revoked: bool },
  }

  #[pallet::error]
  pub enum Error<T> {
    IndexOutOfBounds,
    NoChange,
    PageOverflow,
  }

  #[pallet::call]
  impl<T: Config> Pallet<T> {
    #[pallet::weight(10_000)]
    pub fn update_status(origin: OriginFor<T>, index: u32, revoked: bool) -> DispatchResult {
      T::StatusUpdateOrigin::ensure_origin(origin)?;
      ensure!(index < T::MaxStatuses::get(), Error::<T>::IndexOutOfBounds);

      let per_page = T::StatusesPerPage::get().max(1);
      let page_index = index / per_page;
      let bit_index = index % per_page;
      let (byte_pos, bit_mask) = bit_position(bit_index);

      StatusPages::<T>::try_mutate(page_index, |page| -> Result<(), DispatchError> {
        let bytes_per_page = Self::bytes_per_page();
        if page.is_empty() {
          page.try_resize(bytes_per_page as usize, 0).map_err(|_| Error::<T>::PageOverflow)?;
        }

        if byte_pos >= page.len() {
          return Err(Error::<T>::PageOverflow.into());
        }

        let currently_revoked = (page[byte_pos] & bit_mask) != 0;
        ensure!(currently_revoked != revoked, Error::<T>::NoChange);

        if revoked {
          page[byte_pos] |= bit_mask;
        } else {
          page[byte_pos] &= !bit_mask;
        }

        Ok(())
      })?;

      Self::deposit_event(Event::StatusUpdated { index, revoked });
      Ok(())
    }
  }

  impl<T: Config> Pallet<T> {
    pub fn get_status(index: u32) -> Option<bool> {
      if index >= T::MaxStatuses::get() {
        return None;
      }

      let per_page = T::StatusesPerPage::get().max(1);
      let page_index = index / per_page;
      let bit_index = index % per_page;
      let (byte_pos, bit_mask) = bit_position(bit_index);

      let page = StatusPages::<T>::get(page_index);
      if page.is_empty() || byte_pos >= page.len() {
        return Some(false);
      }

      Some((page[byte_pos] & bit_mask) != 0)
    }

    fn bytes_per_page() -> u32 {
      let per_page = T::StatusesPerPage::get().max(1);
      ((per_page + 7) / 8).max(1)
    }
  }

  fn bit_position(bit_index: u32) -> (usize, u8) {
    let byte_pos = (bit_index / 8) as usize;
    let offset = (bit_index % 8) as u8;
    (byte_pos, 1u8 << offset)
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use frame_support::{
    assert_noop, assert_ok, parameter_types,
    traits::{ConstU16, ConstU32, Everything},
  };
  use sp_core::H256;
  use sp_runtime::{
    testing::Header,
    traits::{BlakeTwo256, IdentityLookup},
  };

  type UncheckedExtrinsic = frame_system::mocking::MockUncheckedExtrinsic<Test>;
  type Block = frame_system::mocking::MockBlock<Test>;

  frame_support::construct_runtime!(
    pub enum Test where
      Block = Block,
      NodeBlock = Block,
      UncheckedExtrinsic = UncheckedExtrinsic,
    {
      System: frame_system,
      StatusList: pallet,
    }
  );

  parameter_types! {
    pub const BlockHashCount: u64 = 250;
    pub const StatusesPerPage: u32 = 256;
    pub const MaxStatuses: u32 = 1024;
    pub const MaxPageBytes: u32 = 64;
  }

  impl frame_system::Config for Test {
    type BaseCallFilter = Everything;
    type BlockWeights = ();
    type BlockLength = ();
    type DbWeight = ();
    type RuntimeOrigin = RuntimeOrigin;
    type RuntimeCall = RuntimeCall;
    type RuntimeEvent = RuntimeEvent;
    type BlockNumber = u64;
    type Hash = H256;
    type Hashing = BlakeTwo256;
    type AccountId = u64;
    type Lookup = IdentityLookup<Self::AccountId>;
    type Header = Header;
    type RuntimeVersion = ();
    type PalletInfo = PalletInfo;
    type AccountData = ();
    type OnNewAccount = ();
    type OnKilledAccount = ();
    type SystemWeightInfo = ();
    type SS58Prefix = ConstU16<42>;
    type OnSetCode = ();
    type MaxConsumers = ConstU32<16>;
  }

  impl Config for Test {
    type RuntimeEvent = RuntimeEvent;
    type StatusesPerPage = StatusesPerPage;
    type MaxStatuses = MaxStatuses;
    type MaxPageBytes = MaxPageBytes;
    type StatusUpdateOrigin = frame_system::EnsureRoot<Self::AccountId>;
  }

  fn new_test_ext() -> sp_io::TestExternalities {
    let mut storage = frame_system::GenesisConfig::default().build_storage::<Test>().unwrap();
    storage.into()
  }

  #[test]
  fn update_sets_bit() {
    new_test_ext().execute_with(|| {
      assert_ok!(StatusList::update_status(RuntimeOrigin::root(), 10, true));
      assert_eq!(StatusList::get_status(10), Some(true));
    });
  }

  #[test]
  fn duplicate_update_fails() {
    new_test_ext().execute_with(|| {
      assert_ok!(StatusList::update_status(RuntimeOrigin::root(), 5, true));
      assert_noop!(
        StatusList::update_status(RuntimeOrigin::root(), 5, true),
        Error::<Test>::NoChange
      );
      assert_ok!(StatusList::update_status(RuntimeOrigin::root(), 5, false));
      assert_eq!(StatusList::get_status(5), Some(false));
    });
  }

  #[test]
  fn boundary_check_blocks_out_of_range() {
    new_test_ext().execute_with(|| {
      assert_noop!(
        StatusList::update_status(RuntimeOrigin::root(), MaxStatuses::get(), true),
        Error::<Test>::IndexOutOfBounds
      );
    });
  }
}


