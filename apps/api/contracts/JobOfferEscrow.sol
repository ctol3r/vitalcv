// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title JobOfferEscrow
 * @dev Simple escrow contract for job offer deposits. An employer deposits
 * funds intended for a candidate. When the candidate accepts the offer,
 * the deposit is released to the candidate. The employer can cancel the
 * offer before it is accepted and retrieve the funds.
 */
contract JobOfferEscrow {
    enum OfferState { Pending, Accepted, Cancelled }

    struct Offer {
        address employer;
        address candidate;
        uint256 amount;
        OfferState state;
    }

    // offerId => Offer
    mapping(uint256 => Offer) public offers;
    uint256 public nextOfferId;

    event OfferCreated(uint256 indexed offerId, address indexed employer, address indexed candidate, uint256 amount);
    event OfferAccepted(uint256 indexed offerId);
    event OfferCancelled(uint256 indexed offerId);

    /**
     * @dev Employer creates a new offer by depositing ether for the candidate.
     * @param _candidate Address of the candidate.
     */
    function createOffer(address _candidate) external payable returns (uint256) {
        require(msg.value > 0, "Deposit required");
        uint256 offerId = nextOfferId++;
        offers[offerId] = Offer({
            employer: msg.sender,
            candidate: _candidate,
            amount: msg.value,
            state: OfferState.Pending
        });
        emit OfferCreated(offerId, msg.sender, _candidate, msg.value);
        return offerId;
    }

    /**
     * @dev Candidate accepts the offer and receives the funds.
     * @param _offerId Identifier of the offer.
     */
    function acceptOffer(uint256 _offerId) external {
        Offer storage offer = offers[_offerId];
        require(msg.sender == offer.candidate, "Only candidate can accept");
        require(offer.state == OfferState.Pending, "Offer not pending");

        offer.state = OfferState.Accepted;
        payable(offer.candidate).transfer(offer.amount);
        emit OfferAccepted(_offerId);
    }

    /**
     * @dev Employer cancels the offer and gets refund if not yet accepted.
     * @param _offerId Identifier of the offer.
     */
    function cancelOffer(uint256 _offerId) external {
        Offer storage offer = offers[_offerId];
        require(msg.sender == offer.employer, "Only employer can cancel");
        require(offer.state == OfferState.Pending, "Offer not pending");

        offer.state = OfferState.Cancelled;
        payable(offer.employer).transfer(offer.amount);
        emit OfferCancelled(_offerId);
    }
}
