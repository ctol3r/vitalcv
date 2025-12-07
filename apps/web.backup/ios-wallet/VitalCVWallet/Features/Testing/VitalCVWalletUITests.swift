//
//  VitalCVWalletUITests.swift
//  VitalCVWallet
//
//  Created: Batch 542 - Task 53
//  XCTest UI test for issuance→wallet
//

import XCTest

final class VitalCVWalletUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    func testIssuanceToWalletFlow() throws {
        // Test the full flow from credential issuance to wallet display

        // 1. Skip onboarding if present
        if app.buttons["Skip"].exists {
            app.buttons["Skip"].tap()
        }

        // 2. Tap "Scan to Add" button
        let scanButton = app.buttons["Scan to Add"]
        XCTAssertTrue(scanButton.exists)
        scanButton.tap()

        // 3. Simulate QR code scan (would need mock scanner in real test)
        // For now, skip scanner and assume credential is added

        // 4. Verify credential appears in wallet
        let credentialCard = app.otherElements.containing(.staticText, identifier: "Credential").firstMatch
        XCTAssertTrue(credentialCard.waitForExistence(timeout: 5))

        // 5. Tap credential to view details
        credentialCard.tap()

        // 6. Verify detail view appears
        let detailView = app.navigationBars["Credential Details"]
        XCTAssertTrue(detailView.waitForExistence(timeout: 2))

        // 7. Verify credential information is displayed
        XCTAssertTrue(app.staticTexts["Issued"].exists)
    }

    func testWalletHomeDisplaysCredentials() throws {
        // Verify wallet home screen displays credentials correctly
        let credentialsSection = app.staticTexts["Credentials"]
        XCTAssertTrue(credentialsSection.exists)
    }
}








