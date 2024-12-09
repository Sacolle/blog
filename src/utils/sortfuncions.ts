import type { CollectionEntry } from 'astro:content';

function parseDate(d: string): Date{
	let [day, month, year] = d.split('/') as any
	const dateObj = new Date(+year, +month - 1, +day)
	return dateObj
}

/**
 * ordena os post de forma descendente baseado na data de criação
 * @param posts : lista de posts
 */
export function sortPosts(posts: CollectionEntry<'posts'>[]): void{
	posts.sort(({data : d1}, {data: d2}) => {
		const date1 = parseDate(d1.createdAt).getTime()
		const date2 = parseDate(d2.createdAt).getTime()
		return date2 - date1
	})
}