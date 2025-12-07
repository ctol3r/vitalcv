#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

use frame_support::pallet_prelude::*;
use frame_system::pallet_prelude::*;
use sp_std::vec::Vec;

#[frame_support::pallet]
pub mod pallet {
  use super::*;
  use frame_support::{BoundedBTreeSet, BoundedVec};

  #[pallet::config]
  pub trait Config: frame_system::Config {
    type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

    #[pallet::constant]
    type MaxTitleLength: Get<u32>;

    #[pallet::constant]
    type MaxDescriptionLength: Get<u32>;

    #[pallet::constant]
    type MaxValidators: Get<u32>;

    #[pallet::constant]
    type ExecutionThreshold: Get<u32>;

    type ProposalOrigin: EnsureOrigin<Self::RuntimeOrigin, Success = Self::AccountId>;
    type ValidatorOrigin: EnsureOrigin<Self::RuntimeOrigin, Success = Self::AccountId>;
  }

  #[derive(
    Clone, Copy, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen, Default,
  )]
  pub enum ProposalStatus {
    #[default]
    Draft,
    Active,
    Accepted,
    Rejected,
    Executed,
  }

  #[derive(Clone, Copy, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
  pub enum VoteKind {
    Yes,
    No,
    Abstain,
  }

  #[derive(Clone, Encode, Decode, Eq, PartialEq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
  pub struct ProposalRecord<T: Config> {
    pub proposer: T::AccountId,
    pub title: BoundedVec<u8, T::MaxTitleLength>,
    pub description: BoundedVec<u8, T::MaxDescriptionLength>,
    pub status: ProposalStatus,
    pub yes_votes: u32,
    pub no_votes: u32,
    pub abstain_votes: u32,
    pub approvals: u32,
    pub created_at: T::BlockNumber,
    pub updated_at: T::BlockNumber,
  }

  impl<T: Config> ProposalRecord<T> {
    fn threshold() -> u32 {
      T::ExecutionThreshold::get().max(1)
    }

    fn record_vote(&mut self, vote: VoteKind) {
      match vote {
        VoteKind::Yes => self.yes_votes = self.yes_votes.saturating_add(1),
        VoteKind::No => self.no_votes = self.no_votes.saturating_add(1),
        VoteKind::Abstain => self.abstain_votes = self.abstain_votes.saturating_add(1),
      }
    }

    fn retract_vote(&mut self, vote: VoteKind) {
      match vote {
        VoteKind::Yes => self.yes_votes = self.yes_votes.saturating_sub(1),
        VoteKind::No => self.no_votes = self.no_votes.saturating_sub(1),
        VoteKind::Abstain => self.abstain_votes = self.abstain_votes.saturating_sub(1),
      }
    }

    fn refresh_status(&mut self) {
      if self.status == ProposalStatus::Executed {
        return;
      }

      if self.yes_votes >= Self::threshold() {
        self.status = ProposalStatus::Accepted;
      } else if self.no_votes >= Self::threshold() {
        self.status = ProposalStatus::Rejected;
      } else if self.status == ProposalStatus::Draft {
        self.status = ProposalStatus::Active;
      }
    }
  }

  #[pallet::storage]
  #[pallet::getter(fn proposals)]
  pub type Proposals<T: Config> =
    StorageMap<_, Blake2_128Concat, u64, ProposalRecord<T>, OptionQuery>;

  #[pallet::storage]
  #[pallet::getter(fn next_proposal_id)]
  pub type NextProposalId<T> = StorageValue<_, u64, ValueQuery>;

  #[pallet::storage]
  pub type Votes<T: Config> =
    StorageDoubleMap<_, Blake2_128Concat, u64, Blake2_128Concat, T::AccountId, VoteKind, OptionQuery>;

  #[pallet::storage]
  pub type ExecutionApprovals<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    u64,
    BoundedBTreeSet<T::AccountId, T::MaxValidators>,
    ValueQuery
  >;

  #[pallet::event]
  #[pallet::generate_deposit(pub(super) fn deposit_event)]
  pub enum Event<T: Config> {
    ProposalCreated { proposal_id: u64, proposer: T::AccountId },
    VoteCast { proposal_id: u64, voter: T::AccountId, vote: VoteKind },
    ProposalExecuted { proposal_id: u64, approver: T::AccountId },
  }

  #[pallet::error]
  pub enum Error<T> {
    TitleTooLong,
    DescriptionTooLong,
    ProposalNotFound,
    VotingClosed,
    DuplicateApproval,
    TooManyApprovals,
  }

  #[pallet::call]
  impl<T: Config> Pallet<T> {
    #[pallet::weight(10_000)]
    pub fn submit_proposal(
      origin: OriginFor<T>,
      title: Vec<u8>,
      description: Vec<u8>,
    ) -> DispatchResult {
      let proposer = T::ProposalOrigin::ensure_origin(origin)?;
      let bounded_title: BoundedVec<_, _> =
        title.try_into().map_err(|_| Error::<T>::TitleTooLong)?;
      let bounded_description: BoundedVec<_, _> =
        description.try_into().map_err(|_| Error::<T>::DescriptionTooLong)?;

      let proposal_id = NextProposalId::<T>::get();
      let now = <frame_system::Pallet<T>>::block_number();

      Proposals::<T>::insert(
        proposal_id,
        ProposalRecord::<T> {
          proposer: proposer.clone(),
          title: bounded_title,
          description: bounded_description,
          status: ProposalStatus::Active,
          yes_votes: 0,
          no_votes: 0,
          abstain_votes: 0,
          approvals: 0,
          created_at: now,
          updated_at: now,
        },
      );
      NextProposalId::<T>::put(proposal_id.saturating_add(1));

      Self::deposit_event(Event::ProposalCreated { proposal_id, proposer });
      Ok(())
    }

    #[pallet::weight(10_000)]
    pub fn cast_vote(
      origin: OriginFor<T>,
      proposal_id: u64,
      vote: VoteKind,
    ) -> DispatchResult {
      let voter = T::ValidatorOrigin::ensure_origin(origin)?;

      Proposals::<T>::try_mutate(proposal_id, |maybe| -> DispatchResult {
        let proposal = maybe.as_mut().ok_or(Error::<T>::ProposalNotFound)?;
        ensure!(proposal.status != ProposalStatus::Executed, Error::<T>::VotingClosed);

        if let Some(previous) = Votes::<T>::get(proposal_id, &voter) {
          proposal.retract_vote(previous);
        }

        proposal.record_vote(vote);
        proposal.refresh_status();
        proposal.updated_at = <frame_system::Pallet<T>>::block_number();
        Votes::<T>::insert(proposal_id, &voter, vote);
        Ok(())
      })?;

      Self::deposit_event(Event::VoteCast { proposal_id, voter, vote });
      Ok(())
    }

    #[pallet::weight(10_000)]
    pub fn execute(origin: OriginFor<T>, proposal_id: u64) -> DispatchResult {
      let approver = T::ValidatorOrigin::ensure_origin(origin)?;

      let mut approvals = ExecutionApprovals::<T>::get(proposal_id);
      ensure!(!approvals.contains(&approver), Error::<T>::DuplicateApproval);
      approvals
        .try_insert(approver.clone())
        .map_err(|_| Error::<T>::TooManyApprovals)?;

      let threshold = T::ExecutionThreshold::get().max(1) as usize;
      let reached_threshold = approvals.len() >= threshold;
      ExecutionApprovals::<T>::insert(proposal_id, approvals.clone());

      if reached_threshold {
        Proposals::<T>::try_mutate(proposal_id, |maybe| -> DispatchResult {
          let proposal = maybe.as_mut().ok_or(Error::<T>::ProposalNotFound)?;
          proposal.status = ProposalStatus::Executed;
          proposal.approvals = approvals.len() as u32;
          proposal.updated_at = <frame_system::Pallet<T>>::block_number();
          Ok(())
        })?;
        ExecutionApprovals::<T>::remove(proposal_id);
        Self::deposit_event(Event::ProposalExecuted { proposal_id, approver });
      }

      Ok(())
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use frame_support::{
    assert_ok, parameter_types,
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
      Governance: pallet,
    }
  );

  parameter_types! {
    pub const BlockHashCount: u64 = 250;
    pub const MaxTitleLength: u32 = 128;
    pub const MaxDescriptionLength: u32 = 1024;
    pub const MaxValidators: u32 = 16;
    pub const ExecutionThreshold: u32 = 2;
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
    type MaxTitleLength = MaxTitleLength;
    type MaxDescriptionLength = MaxDescriptionLength;
    type MaxValidators = MaxValidators;
    type ExecutionThreshold = ExecutionThreshold;
    type ProposalOrigin = frame_system::EnsureSigned<Self::AccountId>;
    type ValidatorOrigin = frame_system::EnsureSigned<Self::AccountId>;
  }

  fn new_test_ext() -> sp_io::TestExternalities {
    let mut storage = frame_system::GenesisConfig::default().build_storage::<Test>().unwrap();
    storage.into()
  }

  #[test]
  fn create_and_vote_executes() {
    new_test_ext().execute_with(|| {
      assert_ok!(Governance::submit_proposal(
        RuntimeOrigin::signed(1),
        b'Block time tuning'.to_vec(),
        b'Adjust target block time'.to_vec()
      ));

      assert_ok!(Governance::cast_vote(RuntimeOrigin::signed(11), 0, VoteKind::Yes));
      assert_ok!(Governance::cast_vote(RuntimeOrigin::signed(12), 0, VoteKind::Yes));
      assert_ok!(Governance::execute(RuntimeOrigin::signed(11), 0));
      assert_ok!(Governance::execute(RuntimeOrigin::signed(12), 0));

      let record = Governance::proposals(0).expect("proposal exists");
      assert_eq!(record.status, ProposalStatus::Executed);
      assert_eq!(record.approvals, 2);
    });
  }
}









