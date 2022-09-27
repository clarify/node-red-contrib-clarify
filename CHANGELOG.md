# Changelog

## 2.2.0

### Changes

- Updated `@clarify/api` to 0.3.0

## 2.1.0

### New features

- Support for including `enumValues` is restored.
- Added new payload formats: You're now allowed to send in just a number as the payload, an object containing a time and a value, or the existing format, an object with two arrays with `times` and `values`.
- Allow setting `valueType` on the signal. `type` is being renamed to `valueType` on the API. We will be trating `type` as an alias for `valueType`.

## 2.0.0

### Breaking changes

- Remove override fields from `clarify-api` node. You can only configure it using a credentials file.
- All `input` errors are now catchable, and won’t be send through the wire if the request fails.
- The `clarify_insert` node no longer has an output, all errors are catchable using an `catch` block.
- Remove support for Node 12
- Moved packaged from `@searis/node-red-contrib-clarify` to `@searis/node-red-contrib-clarify`.
  - We’ll continue to publish the old package for the lifetime of the v2, but we’ll deprecate it.

## 2.0.0-beta.1

### Breaking changes

- Remove override fields from `clarify-api` node. You can only configure it using a credentials file.
- All `input` errors are now catchable, and won’t be send through the wire if the request fails.
- Remove support for Node 12
- Moved packaged from `@searis/node-red-contrib-clarify` to `@searis/node-red-contrib-clarify`.
  - We’ll continue to publish the old package for the lifetime of the v2, but we’ll deprecate it.

## 1.0.2

- Use less strict input id (topic) requirements

## 1.0.1

- Changed default branch name from `master` to `main`.

## 1.0.0

- Change outputs to only output data from Clarify servers.
- Merged the two outputs from the insert block into one output. See node documentation for more information.
- Change Clarify URLs from clarify.us to clarify.io.

## 1.0.0-beta.9

- Moved code from repo github.com/searis to github.com/clarify.

## 1.0.0-beta.8

- Bugfix: reset mutex on http error in fetchToken

## 1.0.0-beta.7

- Minimum buffertime is 5 seconds
- Use new endpoint for access tokens

## 1.0.0-beta.4 - Breaking changes from -beta.3

Updated the format of the messages according to this proposal: https://github.com/clarify/node-red-contrib-clarify/issues/28

- The Input ID is put in `msg.topic`
- The signal meta data is moved out of the payload to `msg.signal`
- `msg.payload.data.times` is renamed/moved to `msg.payload.times`
- `msg.payload.data.series` is renamed/moved to `msg.payload.values`

New message format:

```js
msg:
  topic: "<Input ID>"
  payload:
    times: ["<timestamp>", ...]
    values: [(<number>||null), ...]
  signal: <Signal> // Match https://docs.clarify.io/reference#signal
```
