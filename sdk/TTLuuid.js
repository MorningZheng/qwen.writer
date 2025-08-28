const {v5, validate} = require('uuid');
const crypto = require("crypto");

const v5tov4 = (uuid5) => {
    // 去掉横杠
    const hex = uuid5.replace(/-/g, "");

    // 把 v5 当作种子，做 SHA-256
    const hash = crypto.createHash("sha256").update(hex).digest();

    // 取前 16 字节作为 UUID
    const bytes = Buffer.from(hash);

    // 修改版本号 (第7字节高4位 -> 0100 = v4)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;

    // 修改变体 (第9字节高2位 -> 10)
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    // 转成 UUID 格式字符串
    const outHex = [...bytes.slice(0, 16)]
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

    return `${outHex.slice(0, 8)}-${outHex.slice(8, 12)}-${outHex.slice(12, 16)}-${outHex.slice(16, 20)}-${outHex.slice(20)}`;
}

const use_ttl_uuid = (name_space, default_ms = 10 * 1000) => {
    // if(Array.isArray(name_space))name_space=v5(name_space[0], name_space[1]);
    name_space = validate(name_space) ? name_space : v5(name_space, v5.DNS);

    const store = new Map()
    const timers = new Map()

    const set = (key, value, ttlMs = default_ms) => {
        timers.get(key)
        clearTimeout(timers.get(key))
        timers.delete(key)
        store.set(key, value)

        if (Number.isFinite(ttlMs) && ttlMs > 0) timers.set(key, setTimeout(() => {
            store.delete(key);
            timers.delete(key);
        }, ttlMs));

        return expose
    }

    const get = key => store.get(key)
    const has = key => store.has(key)
    const del = key => {
        clearTimeout(timers.get(key));
        timers.delete(key);
        return store.delete(key)
    }
    const clear = () => {
        timers.forEach(clearTimeout);
        timers.clear();
        store.clear();
    };

    const use = data => {
        const uid = v5tov4(v5(data.constructor === String ? data : JSON.stringify(data), name_space ?? v5.DNS));
        if (!store.has(data)) set(data, uid);
        return store.get(data);
    }

    const expose = {
        use, set, get, has, del, clear,
        get size() {
            return store.size
        },
        [Symbol.iterator]: () => store[Symbol.iterator](),
        keys: () => store.keys(),
        values: () => store.values(),
        entries: () => store.entries(),
    }

    return expose
}

module.exports = use_ttl_uuid

// // 使用示例
// const cache = createTTLMap(5000)
// cache.set('k1', 'v1', 2000)
//
// setTimeout(() => console.log(cache.get('k1')), 2500) // 2秒后输出 undefined
