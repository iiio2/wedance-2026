@c3
Feature: C3 — Going: plan, share, discover

  Going is a planning action — not a ticket and not free admission. A new
  Going is hidden; a dancer appears to others only after explicitly choosing
  to be seen. Write scenarios run against the local test database only, with
  synthetic dancers signed in through a seeded session.

  # ── RAZ-714 — Keep Going through navigation, reload and undo ──

  @write
  Scenario: Going survives navigation, reload and undo
    Given the test environment is safe to write
    And Munich has a weekly practica and a one-off social this week
    And the browser clock is the day before them
    And I am signed in as "Ana"
    And I watch the console for hydration warnings
    When I open the "munich" city page
    And I tap "Going?" on the one-off social
    Then the one-off social shows "Going!"
    When I open the one-off social
    Then the event page shows "Going!" and 1 going
    When I scroll through the page and reload it
    Then the event page shows "Going!" and 1 going
    And the database has one Going for "Ana" on the one-off social
    When I tap "Going!" to undo
    And I reload the page
    Then the event page shows "Going?" and 0 going
    And the database has no Going for "Ana" on the one-off social
    And there were no hydration warnings

  # ── RAZ-715 — Share attendance explicitly and hide it again ──
  # Ordinary events only: the festival path keeps its own verified-ticket rule
  # (RAZ-314) and is not covered here.

  @write
  Scenario: Attendance stays private until shared, and is hidden again after opting out
    Given the test environment is safe to write
    And an ordinary event with no attendees
    And synthetic dancers "Ana" and "Ben" with public profiles and photos
    When "Ana" marks Going on the event
    Then the database shows "Ana" Going on the event, hidden
    And "Ben" does not see "Ana" in the event's deck
    When "Ana" chooses "Show me in the deck" in the event's deck
    Then "Ben" sees "Ana" in the event's deck
    # No UI control for opting out exists today (RAZ-721) — the step calls the API.
    When "Ana" opts out of the going list through the API
    Then "Ben" does not see "Ana" in the event's deck

  # ── RAZ-687 — Going stays separate from ticket navigation ──

  @write
  Scenario Outline: Going is a planning action next to the ticket link — <case>
    Given the test environment is safe to write
    And an ordinary event <links>
    And I am signed in as "Ana"
    When I open that event
    Then the event hero <tickets>
    And the event page never promises free entry
    When I tap "Going?" in the event hero
    Then the event hero shows "Going!"
    And the event hero <tickets>
    And the database shows "Ana" Going on that event, not as a ticket holder

    Examples:
      | case         | links                                  | tickets                                                          |
      | website only | with a website but no ticket link      | offers no ticket button and links the website as "Event website" |
      | ticket link  | with a ticket link and a website       | offers "Get tickets" linking to the ticket page                  |

  # ── RAZ-716 — Discover dancers without a social paywall or a blank section ──

  @write
  Scenario Outline: "Shall we dance?" is never a paywall or a blank section — <case>
    Given the test environment is safe to write
    And an ordinary event <attendees>
    And <viewer>
    When I open that event
    Then the "Shall we dance?" section shows <shows>
    And the "Shall we dance?" section offers no paid or free-spot social pass

    Examples:
      | case                   | attendees                                                | viewer                 | shows                                                |
      | attendees, signed in   | with an eligible attendee and one whose photo is broken | I am signed in as "Ben" | only the eligible attendee's card                    |
      | empty, signed in       | with no attendees                                        | I am signed in as "Ben" | the "I'm going, show me" call to action              |
      | attendees, signed out  | with an eligible attendee and one whose photo is broken | I am not signed in      | the sign-up dance card and no attendee faces         |
      | empty, signed out      | with no attendees                                        | I am not signed in      | the sign-up dance card and no attendee faces         |

  # ── RAZ-709 — Loading, empty and failed discovery requests ──

  @write
  Scenario: Discovery shows progress while loading, then the empty-state call to action
    Given the test environment is safe to write
    And an ordinary event with no attendees
    And I am signed in as "Ben"
    And the discovery request is slow
    When I open that event
    Then the "Shall we dance?" section shows a loading indicator
    And then the "Shall we dance?" section shows the "I'm going, show me" call to action

  # KNOWN GAP (RAZ-297, backlog): DiscoverDancers swallows a failed pool request
  # and shows the empty state ("No dancers in the deck yet"). @fail = expected to
  # fail until RAZ-297 adds an error + retry state; remove the tag then.
  @write @fail
  Scenario: A failed discovery request does not claim nobody is going
    Given the test environment is safe to write
    And an ordinary event with an eligible attendee and one whose photo is broken
    And I am signed in as "Ben"
    And the discovery request fails
    When I open that event
    Then the "Shall we dance?" section does not say there are no dancers
    And it offers to try loading the dancers again
