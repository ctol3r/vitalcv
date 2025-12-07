#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

use frame_support::pallet_prelude::*;
use frame_system::pallet_prelude::*;
use sp_std::vec::Vec;

#[frame_support::pallet]
pub mod pallet {
  use super::*;

  #[pallet::config]
  pub trait Config: frame_system::Config {
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
    #[pallet::constant]
    type MaxDidLength: Get<u32>;
    #[pallet::constant]
    type MaxJurisdictionLength: Get<u32>;
    type RegistrationOrigin: EnsureOrigin<Self::RuntimeOrigin>;
  }

  #[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo)]
  pub struct TrustLinkRecord<T: Config> {
    pub did: BoundedVec<u8, T::MaxDidLength>;
    pub jurisdiction: BoundedVec<u8, T::MaxJurisdictionLength>;
    pub nppes_hash: [u8; 32];
    pub updated_at: T::BlockNumber;
  }

  #[pallet::storage]
  #[pallet::getter(fn entries)]
  pub type TrustLinks<T: Config> =
    StorageMap<_, Blake2_128Concat, u64, TrustLinkRecord<T>, OptionQuery>;

  #[pallet::event]
  #[pallet::generate_deposit(pub(super) fn deposit_event)]
  pub enum Event<T: Config> {
    LinkStored { npi: u64, did: Vec<u8> },
    LinkRemoved { npi: u64 },
  }

  #[pallet::error]
  pub enum Error<T> {
    InvalidDid,
    InvalidJurisdiction,
    NotFound,
  }

  #[pallet::call]
  impl<T: Config> Pallet<T> {
    #[pallet::weight(10_000)]
    pub fn upsert_link(
      origin: OriginFor<T>,
      npi: u64,
      did: Vec<u8>,
      jurisdiction: Vec<u8>,
      nppes_hash: [u8; 32]
    ) -> DispatchResult {
      T::RegistrationOrigin::ensure_origin(origin)?;

      let bounded_did: BoundedVec<_, _> = did.try_into().map_err(|_| Error::<T>::InvalidDid)?;
      let bounded_jurisdiction: BoundedVec<_, _> = jurisdiction
        .try_into()
        .map_err(|_| Error::<T>::InvalidJurisdiction)?;

      let record = TrustLinkRecord::<T> {
        did: bounded_did.clone(),
        jurisdiction: bounded_jurisdiction,
        nppes_hash,
        updated_at: <frame_system::Pallet<T>>::block_number(),
      };

      TrustLinks::<T>::insert(npi, record);
      Self::deposit_event(Event::LinkStored { npi, did: bounded_did.into_inner() });
      Ok(())
    }

    #[pallet::weight(10_000)]
    pub fn remove_link(origin: OriginFor<T>, npi: u64) -> DispatchResult {
      T::RegistrationOrigin::ensure_origin(origin)?;
      ensure!(TrustLinks::<T>::contains_key(npi), Error::<T>::NotFound);
      TrustLinks::<T>::remove(npi);
      Self::deposit_event(Event::LinkRemoved { npi });
      Ok(())
    }
  }

  impl<T: Config> Pallet<T> {
    pub fn resolve(npi: u64) -> Option<TrustLinkRecord<T>> {
      TrustLinks::<T>::get(npi)
    }
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
      TrustLink: pallet,
    }
  );

  parameter_types! {
    pub const BlockHashCount: u64 = 250;
    pub const MaxDidLength: u32 = 128;
    pub const MaxJurisdictionLength: u32 = 32;
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
    type MaxDidLength = MaxDidLength;
    type MaxJurisdictionLength = MaxJurisdictionLength;
    type RegistrationOrigin = frame_system::EnsureRoot<Self::AccountId>;
  }

  fn new_test_ext() -> sp_io::TestExternalities {
    let mut storage = frame_system::GenesisConfig::default().build_storage::<Test>().unwrap();
    storage.into()
  }

  #[test]
  fn store_and_resolve_trust_link() {
    new_test_ext().execute_with(|| {
      let did = b'did:web:vital.example/provider'.to_vec();
      assert_ok!(TrustLink::upsert_link(
        RuntimeOrigin::root(),
        1234567890,
        did.clone(),
        b'US-CA'.to_vec(),
        [9u8; 32]
      ));
      let record = TrustLink::resolve(1234567890).expect("record should exist");
      assert_eq!(record.did.into_inner(), did);
    });
  }

  #[test]
  fn remove_requires_existing_record() {
    new_test_ext().execute_with(|| {
      assert_noop!(
        TrustLink::remove_link(RuntimeOrigin::root(), 555),
        Error::<Test>::NotFound
      );
    });
  }

  #[test]
  fn rejects_long_inputs() {
    new_test_ext().execute_with(|| {
      let long_did = vec![0u8; (MaxDidLength::get() + 1) as usize];
      assert_noop!(
        TrustLink::upsert_link(
          RuntimeOrigin::root(),
          1,
          long_did,
          b'US'.to_vec(),
          [0u8; 32]
        ),
        Error::<Test>::InvalidDid
      );
    });
  }
}











