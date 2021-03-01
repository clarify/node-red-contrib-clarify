# node-red-contrib-clarify
Node-Red Nodes for adding data to Clarify
Learn more about Clarify at: https://www.searis.no/clarify

Available nodes are:
* clarify_api: A configuration node to establish connection to Clarify.
* clarify_insert: A node to insert data in Clarify.

The ensure-signal node relies on context info to persist deploys and restarts to store the id of the created signal and item.
In-memory storage (which is enabled by default) does not persist deploys and restarts and it is therefore necessary to enable
local file system storage for context. This is done by setting the following in your node-red settings.js.

```
    contextStorage: {
        default: {
            module: "localfilesystem"
        },
    },
```

Any questions? Send us an email on teknisk@searis.no
