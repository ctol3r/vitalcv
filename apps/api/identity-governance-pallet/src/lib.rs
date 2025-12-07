#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use frame_support::{dispatch::DispatchResult, pallet_prelude::*};
    use frame_system::pallet_prelude::*;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
        /// Maximum length of a policy proposal.
        #[pallet::constant]
        type MaxPolicyLength: Get<u32>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    #[pallet::storage]
    #[pallet::getter(fn proposal_count)]
    pub type ProposalCount<T> = StorageValue<_, u32, ValueQuery>;

    #[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, TypeInfo)]
    pub struct PolicyProposal<T: Config> {
        pub proposer: T::AccountId,
        pub policy: BoundedVec<u8, T::MaxPolicyLength>,
        pub votes_for: u32,
        pub votes_against: u32,
    }

    #[pallet::storage]
    pub type Proposals<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u32,
        PolicyProposal<T>,
    >;

    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// A new policy proposal has been submitted.
        ProposalSubmitted { proposer: T::AccountId, proposal_id: u32 },
        /// A vote has been cast on a proposal.
        VoteCast { voter: T::AccountId, proposal_id: u32, approve: bool },
        /// A proposal has been approved and enacted.
        ProposalApproved { proposal_id: u32 },
        /// A proposal has been rejected.
        ProposalRejected { proposal_id: u32 },
    }

    #[pallet::error]
    pub enum Error<T> {
        ProposalTooLong,
        ProposalNotFound,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Submit a new policy proposal.
        #[pallet::weight(10_000)]
        pub fn propose(origin: OriginFor<T>, policy: Vec<u8>) -> DispatchResult {
            let who = ensure_signed(origin)?;
            let bounded: BoundedVec<u8, T::MaxPolicyLength> = policy.try_into().map_err(|_| Error::<T>::ProposalTooLong)?;

            let proposal_id = ProposalCount::<T>::get();
            ProposalCount::<T>::put(proposal_id + 1);

            let proposal = PolicyProposal {
                proposer: who.clone(),
                policy: bounded,
                votes_for: 0,
                votes_against: 0,
            };
            Proposals::<T>::insert(proposal_id, proposal);
            Self::deposit_event(Event::ProposalSubmitted { proposer: who, proposal_id });
            Ok(())
        }

        /// Cast a vote on an existing proposal.
        #[pallet::weight(10_000)]
        pub fn vote(origin: OriginFor<T>, proposal_id: u32, approve: bool) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Proposals::<T>::try_mutate_exists(proposal_id, |maybe_prop| {
                let prop = maybe_prop.as_mut().ok_or(Error::<T>::ProposalNotFound)?;
                if approve {
                    prop.votes_for = prop.votes_for.saturating_add(1);
                } else {
                    prop.votes_against = prop.votes_against.saturating_add(1);
                }
                Self::deposit_event(Event::VoteCast { voter: who, proposal_id, approve });
                Ok(())
            })
        }

        /// Finalize a proposal, enacting or rejecting based on majority vote.
        #[pallet::weight(10_000)]
        pub fn finalize(origin: OriginFor<T>, proposal_id: u32) -> DispatchResult {
            let _ = ensure_signed(origin)?;
            Proposals::<T>::try_mutate_exists(proposal_id, |maybe_prop| {
                let prop = maybe_prop.take().ok_or(Error::<T>::ProposalNotFound)?;
                if prop.votes_for > prop.votes_against {
                    Self::deposit_event(Event::ProposalApproved { proposal_id });
                } else {
                    Self::deposit_event(Event::ProposalRejected { proposal_id });
                }
                Ok(())
            })
        }
    }
}
