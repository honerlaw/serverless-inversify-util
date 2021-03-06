# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [0.10.1] - 2017-12-14
### Added
- `postHandle` is also called when an error occurs (if the error contains a statusCode)

## [0.10.0] - 2017-12-14
### Added
- `IService` now has `preHandle` and `postHandle` methods that are executed before / after every single handler method.
- `HttpHandler` has an options object to add custom options to the serverless config
### Changed
- Updated README
- Updated Tests
- Updated dependencies to latest

## [0.9.4] - 2017-11-27
### Added
- ScheduleHandler and associated tests
### Changed
- Updated README

## [0.9.3] - 2017-10-25
### Added
- Missing info to package.json
### Changed
- Updated README

## [0.9.2] - 2017-09-13
### Added
- IoTHandler for adding IoT event handling

## [0.9.1] - 2017-08-31
### Added
- Ability to deploy using `-d` flag was removed in last release and added back in

### Changed
- Fix bug with including incorrectly utility in generated handler file

## [0.9.0] - 2017-08-31
### Added
- Build is bundled using webpack after TypeScript compilation
- Improved file generation / compile time

### Changed
- Start a changelog
- Remove istanbul flags to ignore certain spots in tests to better guage test coverage
- Refactor generation script / generator class
- Better test coverage

### Removed
- Removed service specific build directory