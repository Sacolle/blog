import { z, defineCollection } from 'astro:content';
// 2. Define your collection(s)
const postsCollection = defineCollection({ 
	type: 'content', // v2.5.0 and later
	schema: z.object({
	  title: z.string(),
	  author: z.string(),
	  createdAt: z.string(),
	  updatedAt: z.string(),
	  tags: z.array(z.string()),
	}),
});
// 3. Export a single `collections` object to register your collection(s)
//    This key should match your collection directory name in "src/content"
export const collections = {
  'posts': postsCollection
};