# node-red-contrib-clarify

Node-Red Nodes for adding data to Clarify.
Learn more about Clarify at: https://www.clarify.us

Available nodes are:

- clarify_insert: A node to create signals, update meta-data and insert data into Clarify.
- clarify_api: A `configuration node` to establish connection to Clarify.

![Clarify Insert Node](https://github.com/searis/node-red-contrib-clarify/blob/master/examples/clarify-insert-node.png?raw=true)

This node will create a json-database to keep track of the signals and meta data written to Clarify.

This database will be stored in the default userDir. By default, this directory is a directory called `.node-red` under
the user's home directory, but can be overriden in the `node-red-settings.js`.

If you are moving your node-red instance or creating backups, be sure to include the folder `clarify_db/`.

## Examples

You can find an example flow that shows how to use the insert node in `examples/random-data-example.json`. Please review the `Generate Data` function. Also remember to update the `clarify_api` configuration node with credentials downloaded from your integration in the Clarify Admin Panel.

![Clarify Insert Node](https://github.com/searis/node-red-contrib-clarify/blob/master/examples/random-data-example.png?raw=true)

Any questions? Send us an email on support@clarify.us

## Backwards compatibility

From v1.0.0-beta.4 we do not expect to do any breaking changes to the insert node input message format. However we might add new optional fields.

As for the insert node _output_ message format, development is still ongoing, and breaking changes must be expected before the final v1.0.0 release. The number of outputs may also change.

## Changelog

The changelog is introduced from `v.1.0.0-beta.4`, and describe changes from `v.1.0.0-beta.3`.

### 1.0.0-beta.7

- Minimum buffertime is 5 seconds
- Use new endpoint for access tokens

### 1.0.0-beta.4 - Breaking changes from -beta.3

Updated the format of the messages according to this proposal: https://github.com/searis/node-red-contrib-clarify/issues/28

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
  signal: <Signal> // Match https://docs.clarify.us/reference#signal
```
