export interface FeishuMsg {
  body: {
    content: string; // JSON string format of FeishuMsgContent or FeishuFolderMsgContent
  };
  chat_id: string;
  create_time: string;
  deleted: boolean;
  message_id: string;
  message_position: string;
  msg_type: 'interactive' | 'folder' | string;
  sender: {
    id: string;
    id_type: string;
    sender_type: string;
    tenant_key: string;
  };
  update_time: string;
  updated: boolean;
}

export interface FeishuFolderMsgContent {
  file_key: string;
  file_name: string;
}

export interface FeishuMsgContent {
  title: string;
  elements: Array<FeishuMsgElement[]>;
}

export interface FeishuMsgElement {
  tag: 'text' | 'hr' | 'note' | string;
  text?: string;
  elements?: FeishuMsgElement[];
}
