## ADDED Requirements

### Requirement: Archive Listing and Partial Extraction

The system SHALL support listing archive entries and extracting a subset.

#### Scenario: List entries

- **GIVEN** an archive at a backup location
- **WHEN** the connector lists archive contents
- **THEN** the system SHALL return entry names and paths

#### Scenario: Extract subset

- **GIVEN** an archive and a list of selected entries
- **WHEN** the connector restores a subset
- **THEN** the system SHALL extract only the selected entries
