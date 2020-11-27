var _ = require('lodash');

const signalIDpattern = /^[0-9a-v]{20}_[a-z0-9_]{1,40}$/

module.exports = {
    signalIDpattern: signalIDpattern,
    patchSignalItem: async function (data, old, api) {
        let equal = compareSignals(data, old);
        let createItemEqual = _.isEqual(data.createItem, old.createItem);
        if (equal && createItemEqual) {
            return old, false;
        }

        // Set correct ID from the saved object
        data.item.id = old.item.id;
        try {
            // if the common data is unequal patch signal
            if (!equal) {
                let url = `integrations/${api.integrationID}/signals/${data.signal.id}`;
                await api.metaQuery(url, "PATCH", {}, { ...data.common });
            }
            if (!data.item.id && data.createItem) {
                // create item
                let result = await api.ensureItem({ ...data.item, ...data.common });
                data.item.id = result.data.id;
            } else if (data.item.id) {
                // patch item
                api.metaQuery(`items/${data.item.id}`, "PATCH", {}, { ...data.common });
            }
        } catch (error) {
            throw (error);
        }
        return data, true;
    },
    createSignalItem: async function (data, api) {
        var method = "integration.EnsureFloat64Signal";
        if (data.item.type === "enum") {
            method = "integration.EnsureEnumSignal";
        }

        try {
            let signalData = { "signal": { ...data.signal, ...data.common } };
            await api.ensureSignal(method, signalData);

            if (data.createItem) {
                let result = await api.ensureItem({ ...data.item, ...data.common });
                data.item.id = result.data.id;
            }
        } catch (error) {
            throw (error);
        }
        return data;
    }
}


function compareSignals(obj1, obj2) {
    const labelsEqual = function (l1, l2) {
        let k1 = Object.keys(l1);
        let k2 = Object.keys(l2);

        if (!_.isEqual(k1, k2)) {
            return false;
        }

        for (var key in l1) {
            if (!_.isEqual(l1[key], l2[key])) {
                return false;
            }
        }

        return true;

    }
    return labelsEqual(obj1.common.labels, obj2.common.labels) &&
        _.isEqual(obj1.common.name, obj2.common.name) &&
        _.isEqual(obj1.common.enumValues, obj2.common.enumValues) &&
        _.isEqual(obj1.common.engUnit, obj2.common.engUnit) &&
        _.isEqual(obj1.common.location, obj2.common.location)
}
