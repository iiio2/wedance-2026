@smoke
Feature: Signed-out user clicking "Going" is sent to sign-in

  On an event page the hero asks the organiser's Going question (RAZ-718,
  RAZ-731). A visitor who is not signed in can answer at once: the answer
  counts unconfirmed and a sheet asks for an email to confirm it. Nothing is
  added to a plan until they confirm.

  Scenario: Signed-out visitor answers the event's Going question
    Given I am not signed in
    And I am on an event page
    When I answer the Going question in the event hero
    Then the email confirmation sheet is visible
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
