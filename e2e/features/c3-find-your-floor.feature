@c3
Feature: C3 — Regular: find your floor

  A regular dancer finds weekly socials and practicas in their city, the
  people behind them, and each event's details. Fixtures are synthetic rows
  written straight into the local test database (never a preview — previews
  share the production database) and removed after each scenario. The browser
  clock is pinned to the day before the fixtures' first date, so "this week"
  does not depend on when the suite runs.

  # ── RAZ-711 — Find a recurring local floor from the Regular journey ──
  # Recurring = dated rows sharing a series id (createSeries / the v3 mirror);
  # there is no read-time recurrence engine.

  @write @tz:America/New_York
  Scenario: Find a recurring local floor from the Regular journey
    Given the test environment is safe to write
    And Munich has a weekly practica and a one-off social this week
    And the browser clock is the day before them
    When I open the home page
    Then the journey stage "Regular" promises "Find your floor" with weekly socials, practicas and friends
    When I follow the "Find your floor" stage
    Then I am on the "munich" city page
    And this week lists the weekly practica and the one-off social
    And "After this week" lists the next two dates of the weekly practica
    When I open the weekly practica
    Then the event page shows its start time in Munich time, not the browser's

  # ── RAZ-712 — Explore the city community and the full role directories ──

  @write
  Scenario Outline: Explore the city community and the full <role> directory
    Given the test environment is safe to write
    And a C3 city with an active and an idle profile per role, and a smaller city
    And the browser clock is the day before them
    When I open the cities directory
    Then both C3 cities show their real community counts, the bigger one first
    When I open the C3 city
    Then the "Venues" tab is selected
    When I open the "<tab>" tab
    Then the tab lists the active <role> only
    When I follow the "All" link for <role>
    Then I am on the full <role> directory, listing the active and the idle <role>
    When I open the active <role> profile
    Then its schedule shows this week's event

    Examples:
      | role       | tab        |
      | venues     | Venues     |
      | organisers | Organisers |
      | artists    | Artists    |

  # ── RAZ-703 — Every role directory is server-rendered with its own metadata ──

  @write
  Scenario Outline: The <role> directory is server-rendered with its own SEO metadata
    Given the test environment is safe to write
    And a C3 city with an active and an idle profile per role, and a smaller city
    When I fetch the server-rendered "<role>" directory of the C3 city
    Then the HTML lists the active and the idle <role> without running JavaScript
    And the HTML has the title "<title>" and a canonical URL for "<role>"
    And the HTML carries BreadcrumbList and ItemList structured data for "<role>"

    Examples:
      | role       | title                                           |
      | venues     | Dance Venues in {city} — WeDance                |
      | organisers | Dance Organisers & Promoters in {city} — WeDance |
      | artists    | Salsa Artists & Teachers in {city} — WeDance    |
