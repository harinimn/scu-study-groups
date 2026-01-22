export async function checkVis(connections, looker, lid, seen, sid, field, groups) {
    if (field == 0) {
        return true;
    }
    if (field == 5) {
        return false;
    }

    if (connections.has(sid)) {
        return true;
    } if (field == 4) {
        return false;
    }

    const found = await groups.where("members", "contains", sid).where("members", "contains", lid).limit(1).get();
    if (!found.empty) {
        return true;
    } if (field == 3) {
        return false;
    }

    for (const [quarter, classes] of seen) {
        potential = looker.get(quarter);
        for (c in classes) {
            if (potential.contains(c)) {
                return true;
            }
            if (field == 1 && potential.find(val => val.course == c.course)) {
                return true;
            }
        }
    }

    return false;
}

export async function visProfile(fields, classes, connections, looker, seen, other, groups) {
    var out = {};
    for (const [key, value] of fields) {
        if (await checkVis(connections, classes, looker, other.get("classes"), seen, other.get(key + "_vis"), groups)) {
            out.set(key, other.get(key));
        } else {
            out.set(key, value);
        }
    }
    return out;
}