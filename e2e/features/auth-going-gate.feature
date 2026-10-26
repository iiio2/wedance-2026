@smoke
Feature: Signed-out user clicking "Going" is sent to sign-in

  When a visitor who is not signed in clicks the "Going?" button
  on an event page, they see the sign-up modal instead of the
  event being added to their plan.

  Scenario: Signed-out visitor clicks Going and sees sign-up modal
    Given I am not signed in
    And I am on an event page
    When I click the "Going?" button
    Then the sign-up modal is visible
    And no event is saved to my week plan
    And no Going is saved in the database for that event

  # RAZ-713 — the same gate from the city page (a modal, not a redirect).
  Scenario: Signed-out visitor taps Going on a city page event
    Given the test environment is safe to write
    And I am not signed in
    And Munich has a weekly practica and a one-off social this week
    And the browser clock is the day before them
    When I open the "munich" city page
    And I tap "Going?" on the one-off social
    Then the sign-up modal is visible
    And the one-off social shows "Going?"
    And no Going is saved in the database for the one-off social
