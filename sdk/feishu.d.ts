// Type definitions for writer/sdk/feishu.js
// Generated based on the implementation in feishu.js
// All asynchronous methods use Promise<any> as requested.

declare interface DocType {
    md: string;
    val: number;
    tag: string;
}

declare type DocTypes = Map<string | number, DocType>;

declare interface UseTable {
    table_id: string;

    add(item: object | object[]): Promise<any>;

    //    fieldsArray: Array<any>
    update(records: Array<{
        record_id?: string;
        fields: Array<{ [p: number]: any | number }>
    }>): Promise<any>;

    update(record_id: string, field: { [p: number]: any | number }): Promise<any>;

    get_fields(): Promise<any[]>;

    add_fields(fields: { name: string; filed_name: string; type: string } | Array<{
        name: string;
        filed_name: string;
        type: string
    }>): Promise<any[]>;

    get_all(page_size?: number, options?: {
        sort: Array<{
            field_name: string,
            desc: boolean
        }>
    }): Promise<any[]>;

    update_field(field_id: string, data: {
        filed_name: string;
        type: string
    }): Promise<any[]>;
}

declare interface UseBit {
    app_token: string;

    get_tables(page_size?: number): AsyncGenerator<any, void, unknown>;

    use_table(table_id: string): UseTable;
}

declare interface UseDoc {
    document_id: string;
    readonly types: DocTypes;

    ls(): Promise<any[]>;

    from_html(content: any, offset?: number): Promise<any>;

    from_md(content: any, offset?: number): Promise<any>;

    to_html(): Promise<string>;
}

declare interface UseCardHandler {
    commit(): Promise<any>;

    revoke(): Promise<any>;

    add(element: any): UseCardHandler;

    add_md(...texts: string[]): UseCardHandler;

    add_rows(rows: any[]): UseCardHandler;

    reset(title?: string, summary?: string): UseCardHandler;

    set_id(val: string): UseCardHandler;

    set_title(content: string): UseCardHandler;

    set_summary(content: string): UseCardHandler;
}

declare interface UseChat {
    chat_id: string;

    get_info(): Promise<any>;

    get_menu(): Promise<any>;

    get_config(): Promise<Record<string, string>>;

    send_msg(data?: object | string, msg_type?: string): Promise<any>;

    send_card(data: any): Promise<any>;

    update_card(message_id: string, data: any): Promise<any>;

    use_card(title?: string, summary?: string): UseCardHandler;

    get_messages(start?: number | Date, until?: number | Date, page_token?: number | string): Promise<any>;

    get_tabs(): Promise<any[]>;

    prev_msg(start_time?: number): Promise<any>;
}

declare interface UseMsg {
    forward(chat_id: string): Promise<any>;

    revoke(): Promise<any>;

    reply(data: any): Promise<any>;

    read(): Promise<any[]>;
}

declare interface UseReactions {
    submit(emoji_type?: string): Promise<any>;

    revoke(): Promise<any>;
}

declare interface UseFsFile {
    read_file(): Promise<Buffer>;

    read_yaml(): Promise<any>;
}

declare interface UseFsFolder {
    folder_token: string;

    ls(): Promise<any[]>;

    use_hash(files: Array<{ token: string; modified_time: string }>): string;
}

declare type UseFs = UseFsFile | UseFsFolder;

declare interface BearerRunner {
    with(fn: Function): Promise<any>;
}

export interface FeishuClient {
    // underlying SDKs (kept as any)
    lark: any;
    client: any;

    // websocket helper
    use_ws(hooks: any, params?: any): any;

    // authentication
    get_token(): Promise<string>;

    use_bearer(payload?: any): BearerRunner;

    get_app(id?: string): Promise<any>;

    // Wiki & Bitable
    get_node_info(url: string | URL): Promise<any | null>;

    use_bit(app_token: string): UseBit;

    use_doc(id: string): Promise<UseDoc>;

    use_table(url: string): Promise<{ book: UseBit; table: UseTable }>;

    fields_type: Record<string, { type: number; ui_type: string }>;

    // IM
    use_chat(chat_id: string): UseChat;

    use_msg(msg_id: string): UseMsg;

    use_reactions(message_id: string): UseReactions;

    get_chat_list(): Promise<any[]>;

    // Drive
    use_fs(url: string): UseFs;

    // Other
    get_user(user_id: string): Promise<any>;

    send_msg(id: string, data: any, receive_id_type?: string): Promise<any>;

    upload_file(id: string, file_name: string, file_stream: ReadableStream<any>, receive_id_type?: string): Promise<any>;
}

export function createFeishuClient(app_id: string, app_secret: string, temp_dir: string, expired_delay?: number): FeishuClient;



