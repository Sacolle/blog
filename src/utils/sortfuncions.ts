import type { CollectionEntry } from 'astro:content';

/**
 * ordena os post de forma descendente baseado na data de criação
 * @param posts : lista de posts
 */
export function sortPosts(posts: CollectionEntry<'posts'>[]): void{
	posts.sort(({data : d1}, {data: d2}) => {
		const date1 = new Date(d1.createdAt)
		const date2 = new Date(d2.createdAt)
		return date2.getTime() - date1.getTime() 
	})
}