import { scrapeBook } from '../src/lib/scraper'
import { prisma } from '../src/lib/prisma'

const BOOKMARKS = [
  // readnovelfull.com novels (scrapeable)
  { url: 'https://readnovelfull.com/absolute-resonance.html', title: 'Absolute Resonance' },
  { url: 'https://readnovelfull.com/absolute-regression.html', title: 'Absolute Regression' },
  { url: 'https://readnovelfull.com/dragon-prince-yuan.html', title: 'Dragon Prince Yuan' },
  { url: 'https://readnovelfull.com/rebirth-of-the-nameless-immortal-god.html', title: 'Rebirth of the Nameless Immortal God' },
  { url: 'https://readnovelfull.com/legend-of-ling-tian-v1.html', title: 'Legend of Ling Tian' },
  { url: 'https://readnovelfull.com/divine-god-against-the-heavens.html', title: 'Divine God Against The Heavens' },
  { url: 'https://readnovelfull.com/walker-of-the-worlds-v1.html', title: 'Walker of the Worlds' },
  { url: 'https://readnovelfull.com/legend-of-swordsman-v1.html', title: 'Legend of Swordsman' },
  { url: 'https://readnovelfull.com/the-sovereigns-ascension.html', title: 'The Sovereign\'s Ascension' },
  { url: 'https://readnovelfull.com/chronicles-of-primordial-wars-v1.html', title: 'Chronicles of Primordial Wars' },
  { url: 'https://readnovelfull.com/worlds-apocalypse-online-v1.html', title: 'World\'s Apocalypse Online' },
  { url: 'https://readnovelfull.com/the-world-online-v1.html', title: 'The World Online' },
  { url: 'https://readnovelfull.com/crazy-leveling-system-v1.html', title: 'Crazy Leveling System' },
  { url: 'https://readnovelfull.com/my-vampire-system-v1.html', title: 'My Vampire System' },
  { url: 'https://readnovelfull.com/spare-me-great-lord-v1.html', title: 'Spare Me, Great Lord!' },
  { url: 'https://readnovelfull.com/godly-model-creator-v1.html', title: 'Godly Model Creator' },
  { url: 'https://readnovelfull.com/world-domination-system-v1.html', title: 'World Domination System' },
  { url: 'https://readnovelfull.com/the-legend-of-futian.html', title: 'The Legend of Futian' },
  { url: 'https://readnovelfull.com/this-earth-is-a-bit-fearsome.html', title: 'This Earth is a Bit Fearsome' },
  { url: 'https://readnovelfull.com/nine-star-hegemon-body-arts.html', title: 'Nine Star Hegemon Body Arts' },
  { url: 'https://readnovelfull.com/warlock-of-the-magus-world.html', title: 'Warlock of the Magus World' },
  { url: 'https://readnovelfull.com/spirit-vessel.html', title: 'Spirit Vessel' },
  { url: 'https://readnovelfull.com/i-am-the-fated-villain.html', title: 'I am the Fated Villain' },
  { url: 'https://readnovelfull.com/master-of-the-end-times-v1.html', title: 'Master of the End Times' },
  { url: 'https://readnovelfull.com/i-have-a-mansion-in-the-post-apocalyptic-world-v1.html', title: 'I Have a Mansion in the Post-apocalyptic World' },
  { url: 'https://readnovelfull.com/pocket-hunting-dimension-v1.html', title: 'Pocket Hunting Dimension' },

  // Other sites (title only, no scrape)
  { url: 'https://novelupdates.com/series/the-demon-prince-goes-to-the-academy/', title: 'The Demon Prince Goes to the Academy', noScrape: true },
  { url: 'https://justlightnovels.com/taking-my-reincarnation-one-step-at-a-time/', title: 'Taking My Reincarnation One Step at a Time', noScrape: true },
  { url: 'https://justlightnovels.com/private-tutor-to-the-dukes-daughter/', title: 'Private Tutor to the Duke\'s Daughter', noScrape: true },
  { url: 'https://justlightnovels.com/isekai-tensei-recruited-to-another-world/', title: 'Isekai Tensei: Recruited to Another World', noScrape: true },
  { url: 'https://novellive.app/book/the-martial-unity', title: 'The Martial Unity' },
]

async function main() {
  console.log('🌱 Seeding bookmarked novels...')

  for (const bookmark of BOOKMARKS) {
    // Check if already exists (these legacy books have no userId)
    const existing = await prisma.book.findFirst({
      where: { siteUrl: bookmark.url, userId: null },
    })

    if (existing) {
      console.log(`⏭️  "${bookmark.title}" already exists`)
      continue
    }

    if (bookmark.noScrape) {
      // Create with title only
      await prisma.book.create({
        data: {
          title: bookmark.title,
          siteUrl: bookmark.url,
          status: 'PLAN_TO_READ',
          currentChapter: 0,
          totalChapters: 0,
        },
      })
      console.log(`✨ Created "${bookmark.title}" (title only)`)
    } else {
      // Scrape metadata
      try {
        const scraped = await scrapeBook(bookmark.url)
        if (scraped) {
          await prisma.book.create({
            data: {
              title: scraped.title || bookmark.title,
              author: scraped.author || null,
              coverUrl: scraped.coverUrl || null,
              description: scraped.description || null,
              genre: scraped.genre || null,
              siteUrl: bookmark.url,
              status: 'PLAN_TO_READ',
              currentChapter: 0,
              totalChapters: scraped.totalChapters || 0,
              chapters: {
                create: scraped.chapters?.map((ch) => ({
                  number: ch.number,
                  title: ch.title || null,
                  url: ch.url,
                })) || [],
              },
            },
          })
          console.log(`✨ Created "${scraped.title}" with ${scraped.chapters?.length || 0} chapters`)
        } else {
          // Fallback to title only
          await prisma.book.create({
            data: {
              title: bookmark.title,
              siteUrl: bookmark.url,
              status: 'PLAN_TO_READ',
              currentChapter: 0,
              totalChapters: 0,
            },
          })
          console.log(`✨ Created "${bookmark.title}" (scrape failed, title only)`)
        }
      } catch (e) {
        console.log(`❌ Failed to scrape "${bookmark.title}":`, e instanceof Error ? e.message : String(e))
        // Create with title only as fallback
        await prisma.book.create({
          data: {
            title: bookmark.title,
            siteUrl: bookmark.url,
            status: 'PLAN_TO_READ',
            currentChapter: 0,
            totalChapters: 0,
          },
        })
        console.log(`✨ Created "${bookmark.title}" (title only, error handling)`)
      }
    }
  }

  console.log('✅ Bookmark seeding complete!')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Seed failed:', e)
  process.exit(1)
})
