const crypto = require('crypto');
const {join} = require('path');
const {promises: fs} = require('fs');

const md5 = (...text) => crypto.createHash('md5').update(text.join('')).digest('hex');

const token_cache = new Map();
const get_token = async (id, secret) => {
    const key = `${id}:${secret}`;
    if (!token_cache.has(key)) {
        const filename = join(process.env.TMP ?? require('os').tmpdir(), `feishu.token.${md5(id, secret)}.json`);
        token_cache.set(key, {
            filename,
            data: await fs.readFile(filename, 'utf8').then(JSON.parse).catch(e => null),
        });
    }
    const {data} = token_cache.get(key);
    if (data?.until > Date.now()) return data.tenant_access_token;

    const rs = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            app_id: id,//'cli_a7ebde84347d100b',
            app_secret: secret,//'xZ1L9nG1g9i5VLFSVgjXrhDeIyDt6r3a'
        })
    }).then(rs => rs.json()).catch(e => e);

    if (rs instanceof Error) throw rs;
    if (rs?.msg === 'ok') {
        rs.until = (rs.expire - 30) * 1000 + Date.now();
        return fs.writeFile(token_cache.get(key).filename, JSON.stringify(rs), 'utf8').then(() => rs.tenant_access_token);
    } else throw new Error(`获取飞书token失败: ${rs}`);
}

const useURLSearch = param => {
    const tmp = {};
    for (const key in param) {
        if (param[key] === undefined) continue;
        tmp[key] = param[key];
    }
    return new URLSearchParams(tmp);
}

module.exports = (id, secret) => {
    const use_forward = (chat_id, msg_id) => get_token(id, secret)
        .then(token => fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${msg_id}/forward?receive_id_type=chat_id`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                receive_id: chat_id,
            }),
        }))
        .then(rs => rs.json()).catch(err => console.log(err));

    const use_revoke = (msg_id) => get_token(id, secret)
        .then(token => fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${msg_id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        }))
        .then(rs => rs.json()).catch(err => console.log(err));

    const use_reply = (msg_id, data) => get_token(id, secret)
        .then(token => fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${msg_id}/reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                ...data,
                reply_in_thread: true,
            }),
        }))
        .then(rs => rs.json()).catch(err => console.log(err));

    const send_msg = (target_id, data, type = 'chat_id') => get_token(id, secret)
        .then(token => fetch(`https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${type}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                receive_id: target_id,
                msg_type: "text",
                ...data,
                content: data.content.constructor === String ? data.content : JSON.stringify(data.content),
            }),
        }))
        .then(rs => rs.json()).catch(err => console.log(err));

    const get_chat_list = () => get_token(id, secret)
        .then(token => fetch('https://open.feishu.cn/open-apis/im/v1/chats', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        }))
        .then(rs => rs.json())
        .then(rs => rs.data?.items)
        .catch(err => console.log(err));

    const get_msg_list = (chat_id, start = undefined, until = undefined, page_token = undefined) => get_token(id, secret)
        .then(token => fetch(`https://open.feishu.cn/open-apis/im/v1/messages?${useURLSearch({
            container_id_type: 'chat',
            container_id: chat_id,
            start_time: start ? Math.floor((start?.constructor === Date ? start.getTime() : start) / 1000) : undefined,
            end_time: until ? Math.ceil((until?.constructor === Date ? until.getTime() : until) / 1000) : undefined,
            sort_type: 'ByCreateTimeDesc',
            page_size: Number.isInteger(page_token) ? page_token : 20,
            page_token,
        })}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        }))
        .then(rs => rs.json()).catch(err => console.log(err));

    const read_msg = msg_id => get_token(id, secret)
        .then(token => fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${msg_id}?user_id_type=open_id`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        }))
        .then(rs => rs.json())
        .then(r => r.data.items)
        .catch(err => console.log(err));

    const get_user = user_id => get_token(id, secret)
        .then(token => fetch(`https://open.feishu.cn/open-apis/contact/v3/users/${user_id}?department_id_type=department_id&user_id_type=user_id`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        }))
        .then(rs => rs.json())
        .then(rs=>{
            if(rs.msg==='success')return rs.data.user;
            else throw Object.assign(new Error(rs.msg),rs);
        });

    return {
        get_token() {
            return get_token(id, secret);
        },
        use_forward,
        use_revoke,
        use_reply,
        send_msg,
        get_chat_list,
        get_msg_list,
        read_msg,
        get_user,
    };
}
