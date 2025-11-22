import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';


const base = import.meta.env.BASE_URL

export async function GET(context) {
	const blog = await getCollection('posts')
	return rss({
		// `<title>` field in output xml
		title: 'Colle’s Blog',
		// `<description>` field in output xml
		description: 'Meu blog e tal.',
		// Pull in your project "site" from the endpoint context
		// https://docs.astro.build/en/reference/api-reference/#site
		site: context.site,
		// Array of `<item>`s in output xml
		// See "Generating items" section for examples using content collections and glob imports
		items: blog.map(({id, data}) => ({
			title: data.title,
			author: data.author,
			pubDate: Date(data.createdAt),
			link: `${base}/posts/${id.slice(0, -3)}`
		})),
		// (optional) inject custom xml
		customData: `<language>pt-br</language>`,
	});
}