export interface ChatDocument {
   uid: string;
   title: string;
   category: string;
   tags: string[];
   summary: string;
   contentLoader?: () => Promise<string>;
}
