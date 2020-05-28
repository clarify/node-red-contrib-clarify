# node-red-contrib-clarify
Node-Red Nodes for adding data to Clarify
Learn more about Clarify at: https://www.searis.no/clarify

Available nodes are:
* clarify-add-data: A node to add time series data to the Clarify database
* clarify-api: A configuration node to establish connection to Clarify
* clarify-ensure-signal: A node to create and update signals and items in Clarify
* clarify-inject-enums: A helper node to append enum-values to the message flow
* clarify-inject-labels: A helper node to append labels to the message flow
* clarify-inject-locations: A helper node to append location information to the message flow

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