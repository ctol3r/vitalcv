#![cfg_attr(not(feature = "std"), no_std)]

use frame_support::{dispatch::DispatchResult, pallet_prelude::*, traits::Get};
use frame_system::pallet_prelude::*;
use sp_std::vec::Vec;
use sp_runtime::traits::Hash;

#[frame_support::pallet]
pub mod pallet {
    use super::*;

    #[pallet::config]
    pub trait Config: frame_system::Config {
        type Event: From<Event<Self>> + IsType<<Self as frame_system::Config>::Event>;
        /// Maximum number of validators
        #[pallet::constant]
        type MaxValidators: Get<u32>;
        /// Minimum votes required for multi-sig decisions
        #[pallet::constant]
        type MinVotes: Get<u32>;
        /// Maximum length of DID string
        #[pallet::constant]
        type MaxDidLength: Get<u32>;
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// Governance keys: root, council, technical committee
    #[pallet::storage]
    #[pallet::getter(fn root_key)]
    pub type RootKey<T: Config> = StorageValue<_, T::AccountId, OptionQuery>;

    #[pallet::storage]
    #[pallet::getter(fn council_members)]
    pub type CouncilMembers<T: Config> = StorageValue<_, Vec<T::AccountId>, ValueQuery>;

    #[pallet::storage]
    #[pallet::getter(fn technical_committee)]
    pub type TechnicalCommittee<T: Config> = StorageValue<_, Vec<T::AccountId>, ValueQuery>;

    /// Validator registry: maps validator account to DID and metadata
    #[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct ValidatorInfo<T: Config> {
        pub account: T::AccountId,
        pub did: BoundedVec<u8, T::MaxDidLength>,
        pub jurisdiction: BoundedVec<u8, T::MaxDidLength>,
        pub service_endpoint: BoundedVec<u8, T::MaxDidLength>,
        pub active: bool,
        pub added_at: T::BlockNumber,
    }

    #[pallet::storage]
    #[pallet::getter(fn validators)]
    pub type Validators<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        ValidatorInfo<T>,
        OptionQuery,
    >;

    #[pallet::storage]
    #[pallet::getter(fn validator_count)]
    pub type ValidatorCount<T: Config> = StorageValue<_, u32, ValueQuery>;

    /// Proposals for validator onboarding/offboarding
    #[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    #[scale_info(skip_type_params(T))]
    pub struct ValidatorProposal<T: Config> {
        pub proposer: T::AccountId,
        pub validator_account: T::AccountId,
        pub action: ProposalAction,
        pub votes_for: Vec<T::AccountId>,
        pub votes_against: Vec<T::AccountId>,
        pub created_at: T::BlockNumber,
        pub executed: bool,
    }

    #[derive(Clone, Encode, Decode, PartialEq, Eq, RuntimeDebug, TypeInfo, MaxEncodedLen)]
    pub enum ProposalAction {
        Add,
        Remove,
    }

    #[pallet::storage]
    #[pallet::getter(fn proposal_count)]
    pub type ProposalCount<T: Config> = StorageValue<_, u32, ValueQuery>;

    #[pallet::storage]
    pub type ValidatorProposals<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        u32,
        ValidatorProposal<T>,
        OptionQuery,
    >;

    /// Governance policies
    #[pallet::storage]
    #[pallet::getter(fn policies)]
    pub type Policies<T: Config> = StorageMap<_, Blake2_128Concat, Vec<u8>, Vec<u8>>;

    #[pallet::event]
    #[pallet::generate_deposit(fn deposit_event)]
    pub enum Event<T: Config> {
        PolicySet { key: Vec<u8>, value: Vec<u8>, who: T::AccountId },
        RootKeySet { key: T::AccountId, who: T::AccountId },
        CouncilMemberAdded { member: T::AccountId, who: T::AccountId },
        TechnicalCommitteeMemberAdded { member: T::AccountId, who: T::AccountId },
        ValidatorProposalCreated { proposal_id: u32, proposer: T::AccountId, validator: T::AccountId, action: ProposalAction },
        ValidatorProposalVoted { proposal_id: u32, voter: T::AccountId, approve: bool },
        ValidatorAdded { validator: T::AccountId, did: Vec<u8>, jurisdiction: Vec<u8> },
        ValidatorRemoved { validator: T::AccountId },
        RuntimeUpgradeProposed { proposal_id: u32, code_hash: T::Hash },
    }

    #[pallet::error]
    pub enum Error<T> {
        PolicyNotFound,
        NotAuthorized,
        ValidatorNotFound,
        ValidatorAlreadyExists,
        ProposalNotFound,
        AlreadyVoted,
        ProposalNotExecutable,
        TooManyValidators,
        InvalidDid,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Set root governance key (only callable once or by existing root)
        #[pallet::weight(10_000)]
        pub fn set_root_key(
            origin: OriginFor<T>,
            new_key: T::AccountId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // Allow if no root key set, or if caller is current root
            if let Some(current_root) = RootKey::<T>::get() {
                ensure!(current_root == who, Error::<T>::NotAuthorized);
            }

            RootKey::<T>::put(&new_key);
            Self::deposit_event(Event::RootKeySet { key: new_key, who });
            Ok(())
        }

        /// Add council member (requires root or council approval)
        #[pallet::weight(10_000)]
        pub fn add_council_member(
            origin: OriginFor<T>,
            member: T::AccountId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            // Check authorization: root or council member
            let is_root = RootKey::<T>::get().map_or(false, |root| root == who);
            let is_council = CouncilMembers::<T>::get().contains(&who);
            ensure!(is_root || is_council, Error::<T>::NotAuthorized);

            let mut council = CouncilMembers::<T>::get();
            if !council.contains(&member) {
                council.push(member.clone());
                CouncilMembers::<T>::put(&council);
                Self::deposit_event(Event::CouncilMemberAdded { member, who });
            }
            Ok(())
        }

        /// Add technical committee member
        #[pallet::weight(10_000)]
        pub fn add_technical_committee_member(
            origin: OriginFor<T>,
            member: T::AccountId,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            let is_root = RootKey::<T>::get().map_or(false, |root| root == who);
            ensure!(is_root, Error::<T>::NotAuthorized);

            let mut committee = TechnicalCommittee::<T>::get();
            if !committee.contains(&member) {
                committee.push(member.clone());
                TechnicalCommittee::<T>::put(&committee);
                Self::deposit_event(Event::TechnicalCommitteeMemberAdded { member, who });
            }
            Ok(())
        }

        /// Propose validator onboarding/offboarding
        #[pallet::weight(20_000)]
        pub fn propose_validator(
            origin: OriginFor<T>,
            validator_account: T::AccountId,
            action: ProposalAction,
        ) -> DispatchResult {
            let proposer = ensure_signed(origin)?;

            // Check authorization: council member or root
            let is_root = RootKey::<T>::get().map_or(false, |root| root == proposer);
            let is_council = CouncilMembers::<T>::get().contains(&proposer);
            ensure!(is_root || is_council, Error::<T>::NotAuthorized);

            // Validate action
            match action {
                ProposalAction::Add => {
                    ensure!(!Validators::<T>::contains_key(&validator_account), Error::<T>::ValidatorAlreadyExists);
                    let count = ValidatorCount::<T>::get();
                    ensure!(count < T::MaxValidators::get(), Error::<T>::TooManyValidators);
                },
                ProposalAction::Remove => {
                    ensure!(Validators::<T>::contains_key(&validator_account), Error::<T>::ValidatorNotFound);
                },
            }

            let proposal_id = ProposalCount::<T>::get();
            ProposalCount::<T>::put(proposal_id + 1);

            let proposal = ValidatorProposal {
                proposer: proposer.clone(),
                validator_account: validator_account.clone(),
                action: action.clone(),
                votes_for: vec![proposer.clone()], // Proposer auto-votes
                votes_against: vec![],
                created_at: frame_system::Pallet::<T>::block_number(),
                executed: false,
            };

            ValidatorProposals::<T>::insert(proposal_id, &proposal);
            Self::deposit_event(Event::ValidatorProposalCreated {
                proposal_id,
                proposer,
                validator: validator_account,
                action,
            });
            Ok(())
        }

        /// Vote on validator proposal
        #[pallet::weight(10_000)]
        pub fn vote_validator_proposal(
            origin: OriginFor<T>,
            proposal_id: u32,
            approve: bool,
        ) -> DispatchResult {
            let voter = ensure_signed(origin)?;

            // Check authorization
            let is_root = RootKey::<T>::get().map_or(false, |root| root == voter);
            let is_council = CouncilMembers::<T>::get().contains(&voter);
            ensure!(is_root || is_council, Error::<T>::NotAuthorized);

            ValidatorProposals::<T>::try_mutate(proposal_id, |maybe_proposal| -> DispatchResult {
                let proposal = maybe_proposal.as_mut().ok_or(Error::<T>::ProposalNotFound)?;
                ensure!(!proposal.executed, Error::<T>::ProposalNotExecutable);

                // Check if already voted
                ensure!(!proposal.votes_for.contains(&voter) && !proposal.votes_against.contains(&voter),
                    Error::<T>::AlreadyVoted);

                if approve {
                    proposal.votes_for.push(voter.clone());
                } else {
                    proposal.votes_against.push(voter.clone());
                }

                Self::deposit_event(Event::ValidatorProposalVoted {
                    proposal_id,
                    voter,
                    approve,
                });
                Ok(())
            })
        }

        /// Execute validator proposal (if quorum met)
        #[pallet::weight(30_000)]
        pub fn execute_validator_proposal(
            origin: OriginFor<T>,
            proposal_id: u32,
        ) -> DispatchResult {
            let executor = ensure_signed(origin)?;

            ValidatorProposals::<T>::try_mutate(proposal_id, |maybe_proposal| -> DispatchResult {
                let proposal = maybe_proposal.as_mut().ok_or(Error::<T>::ProposalNotFound)?;
                ensure!(!proposal.executed, Error::<T>::ProposalNotExecutable);

                // Check quorum: votes_for >= MinVotes
                let votes_for_count = proposal.votes_for.len() as u32;
                ensure!(votes_for_count >= T::MinVotes::get(), Error::<T>::ProposalNotExecutable);
                ensure!(votes_for_count > proposal.votes_against.len() as u32, Error::<T>::ProposalNotExecutable);

                // Execute action
                match proposal.action {
                    ProposalAction::Add => {
                        // Note: DID and metadata should be provided via separate extrinsic or off-chain
                        // For now, we create a minimal validator entry
                        let validator_info = ValidatorInfo {
                            account: proposal.validator_account.clone(),
                            did: BoundedVec::try_from(b"did:example:validator".to_vec())
                                .map_err(|_| Error::<T>::InvalidDid)?,
                            jurisdiction: BoundedVec::try_from(b"US".to_vec())
                                .map_err(|_| Error::<T>::InvalidDid)?,
                            service_endpoint: BoundedVec::try_from(b"https://validator.example.com".to_vec())
                                .map_err(|_| Error::<T>::InvalidDid)?,
                            active: true,
                            added_at: frame_system::Pallet::<T>::block_number(),
                        };
                        Validators::<T>::insert(&proposal.validator_account, &validator_info);
                        ValidatorCount::<T>::mutate(|count| *count += 1);
                        Self::deposit_event(Event::ValidatorAdded {
                            validator: proposal.validator_account.clone(),
                            did: b"did:example:validator".to_vec(),
                            jurisdiction: b"US".to_vec(),
                        });
                    },
                    ProposalAction::Remove => {
                        Validators::<T>::remove(&proposal.validator_account);
                        ValidatorCount::<T>::mutate(|count| *count = count.saturating_sub(1));
                        Self::deposit_event(Event::ValidatorRemoved {
                            validator: proposal.validator_account.clone(),
                        });
                    },
                }

                proposal.executed = true;
                Ok(())
            })
        }

        /// Set policy (existing functionality)
        #[pallet::weight(10_000)]
        pub fn set_policy(
            origin: OriginFor<T>,
            key: Vec<u8>,
            value: Vec<u8>,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            Policies::<T>::insert(&key, &value);
            Self::deposit_event(Event::PolicySet { key, value, who });
            Ok(())
        }
    }
}

