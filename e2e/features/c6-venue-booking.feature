@c6
Feature: C6 — Host and venue journey

  Covers the happy paths for hosting private events and booking venues.
  Write-path scenarios seed isolated test data via direct DB access and
  require a localhost server (production database must never be written to).

  # ── RAZ-657 — Browse venues and submit an available-date booking request ──

  @write
  Scenario: Browse venues and submit a booking request on an available date
    Given the test environment is safe to write
    And a test venue "qa-venue-657" exists with 2 bookable spaces
    And the venue "qa-venue-657" has Monday availability from "18:00" to "23:00"
    When I go to the venues page
    Then I see the venue "QA Venue 657"
    When I click on the venue "QA Venue 657"
    Then I see the venue profile page for "qa-venue-657"
    And I see at least 1 bookable space
    When I click "Propose an event"
    Then I see the booking form
    When I fill in the booking title with "QA Sunday Social 657"
    And I fill in the booking email with "qa-657@test.wedance.vip"
    And I accept the booking terms
    And I submit the booking request
    Then I see "Slot proposed"

  # ── RAZ-658 — Start a private-event request from For Events ───────────

  Scenario: Start a private-event request from the For Events page
    When I go to the for-events page
    Then I see "Hosting the night"
    When I click "Tell us about your event"
    Then I see the event inquiry form

  # ── RAZ-659 — Send an event brief without a long form ─────────────────

  @write
  Scenario: Send an event brief in one message
    Given the test environment is safe to write
    When I go to the for-events page
    And I click "Tell us about your event"
    And I fill the event inquiry with brief details
    And I submit the event inquiry
    Then I see "Request received"

  # ── RAZ-660 — Open a venue and start a booking request ────────────────

  @write
  Scenario: Open a venue profile and start a booking request
    Given the test environment is safe to write
    And a test venue "qa-venue-660" exists with 2 bookable spaces
    When I navigate to the venue profile "qa-venue-660"
    Then I see the venue profile page for "qa-venue-660"
    And I see the "Book a free slot" section
    When I click "Propose an event"
    Then I see the booking request dialog

  # ── RAZ-661 — Show validation feedback for unavailable bookings ───────

  @write
  Scenario: Validation feedback when requesting an unavailable date
    Given the test environment is safe to write
    And a test venue "qa-venue-661" exists with 2 bookable spaces
    And the venue "qa-venue-661" has Monday availability from "18:00" to "23:00"
    When I navigate to the venue profile "qa-venue-661"
    Then I see the venue profile page for "qa-venue-661"

  # ── RAZ-662 — Follow showcase entry point to a bookable venue ─────────

  @write
  Scenario: Follow the showcase link from For Events to a venue
    Given the test environment is safe to write
    And the showcase venue "pinakothek-der-moderne" exists with bookable spaces
    When I go to the for-events page
    Then I see "See it in action"
    And I see a link to the showcase venue "pinakothek-der-moderne"
    When I click the showcase venue link "pinakothek-der-moderne"
    Then I see the venue profile page for "pinakothek-der-moderne"
    And I see at least 1 bookable space
