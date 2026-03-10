import path from 'path'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const dbPath = path.resolve(process.cwd(), 'dev.db')
const adapter = new PrismaBetterSqlite3({ url: dbPath })
const prisma = new PrismaClient({ adapter } as any)

const books = [
  // No year / before 2015
  { title: 'Tales of Demons and Gods',                  status: 'DROPPED',    totalChapters: 0,    yearRead: null, isFavorite: false },
  // 2015 group
  { title: 'Coiling Dragon',                            status: 'COMPLETED',  totalChapters: 806,  yearRead: 2015, isFavorite: false },
  { title: 'Stellar Transformation',                    status: 'COMPLETED',  totalChapters: 680,  yearRead: 2015, isFavorite: false },
  { title: 'Shen Yin Wang Zou',                         status: 'COMPLETED',  totalChapters: 871,  yearRead: 2015, isFavorite: false },
  { title: 'Pursuit of Truth',                          status: 'COMPLETED',  totalChapters: 1481, yearRead: 2015, isFavorite: false },
  { title: 'A Will Eternal',                            status: 'COMPLETED',  totalChapters: 1315, yearRead: 2015, isFavorite: false },
  { title: 'Heavenly Jewel Change',                     status: 'COMPLETED',  totalChapters: 848,  yearRead: 2015, isFavorite: false },
  { title: 'Spirit Realm',                              status: 'COMPLETED',  totalChapters: 1841, yearRead: 2015, isFavorite: false },
  { title: 'Wu Dong Qian Kun',                          status: 'COMPLETED',  totalChapters: 1309, yearRead: 2015, isFavorite: false },
  { title: 'Battle Through the Heavens',                status: 'COMPLETED',  totalChapters: 1648, yearRead: 2015, isFavorite: false },
  { title: 'The Great Ruler',                           status: 'COMPLETED',  totalChapters: 1560, yearRead: 2015, isFavorite: false },
  { title: 'True Martial World',                        status: 'COMPLETED',  totalChapters: 1710, yearRead: 2015, isFavorite: false },
  { title: 'Martial World',                             status: 'COMPLETED',  totalChapters: 2255, yearRead: 2015, isFavorite: false },
  { title: 'Lord Xue Ying',                             status: 'COMPLETED',  totalChapters: 1388, yearRead: 2015, isFavorite: false },
  { title: 'Swallowed Star',                            status: 'COMPLETED',  totalChapters: 1486, yearRead: 2015, isFavorite: false },
  { title: 'Super God Gene',                            status: 'COMPLETED',  totalChapters: 3464, yearRead: 2015, isFavorite: false },
  { title: 'Ancient Godly Monarch',                     status: 'COMPLETED',  totalChapters: 2053, yearRead: 2015, isFavorite: false },
  { title: 'Reincarnation Of The Strongest Sword God',  status: 'COMPLETED',  totalChapters: 3954, yearRead: 2015, isFavorite: false },
  { title: 'Immortal Mortal',                           status: 'COMPLETED',  totalChapters: 1230, yearRead: 2015, isFavorite: false },
  { title: 'Peerless Martial God',                      status: 'COMPLETED',  totalChapters: 2500, yearRead: 2015, isFavorite: false },
  { title: 'Sovereign of the Three Realms',             status: 'COMPLETED',  totalChapters: 2376, yearRead: 2015, isFavorite: false },
  { title: 'Ancient Strengthening Technique',           status: 'COMPLETED',  totalChapters: 2492, yearRead: 2015, isFavorite: false },
  { title: 'King of Gods',                              status: 'COMPLETED',  totalChapters: 1585, yearRead: 2015, isFavorite: false },
  { title: 'God of Slaughter',                          status: 'COMPLETED',  totalChapters: 1618, yearRead: 2015, isFavorite: false },
  { title: 'Strongest Abandoned Son',                   status: 'COMPLETED',  totalChapters: 2257, yearRead: 2015, isFavorite: false },
  { title: 'Let Me Game in Peace',                      status: 'COMPLETED',  totalChapters: 1905, yearRead: 2015, isFavorite: false },
  { title: 'Immortal and Martial Dual Cultivation',     status: 'COMPLETED',  totalChapters: 2380, yearRead: 2015, isFavorite: false },
  { title: 'Otherworldly Evil Monarch',                 status: 'COMPLETED',  totalChapters: 1277, yearRead: 2015, isFavorite: false },
  { title: 'Gourmet of Another World',                  status: 'COMPLETED',  totalChapters: 1851, yearRead: 2015, isFavorite: false },
  { title: 'Forty Millenniums of Cultivation',          status: 'COMPLETED',  totalChapters: 3523, yearRead: 2015, isFavorite: true  },
  { title: 'Castle of Black Iron',                      status: 'COMPLETED',  totalChapters: 2015, yearRead: 2015, isFavorite: false },
  { title: 'Realms In The Firmament',                   status: 'COMPLETED',  totalChapters: 1995, yearRead: 2015, isFavorite: false },
  { title: 'Lord of All Realms',                        status: 'COMPLETED',  totalChapters: 1823, yearRead: 2015, isFavorite: false },
  { title: 'Imperial God Emperor',                      status: 'COMPLETED',  totalChapters: 1384, yearRead: 2015, isFavorite: false },
  { title: 'God and Devil World',                       status: 'COMPLETED',  totalChapters: 1217, yearRead: 2015, isFavorite: false },
  { title: 'The Magus Era',                             status: 'COMPLETED',  totalChapters: 1901, yearRead: 2015, isFavorite: false },
  { title: 'The Human Emperor',                         status: 'COMPLETED',  totalChapters: 2467, yearRead: 2015, isFavorite: false },
  { title: 'Talisman Emperor',                          status: 'COMPLETED',  totalChapters: 2202, yearRead: 2015, isFavorite: false },
  { title: 'Second Life Ranker',                        status: 'COMPLETED',  totalChapters: 862,  yearRead: 2015, isFavorite: false },
  { title: 'Ending Maker',                              status: 'COMPLETED',  totalChapters: 356,  yearRead: 2015, isFavorite: false },
  { title: 'Blue Phoenix',                              status: 'COMPLETED',  totalChapters: 790,  yearRead: 2015, isFavorite: false },
  { title: 'Limitless Sword God',                       status: 'COMPLETED',  totalChapters: 1569, yearRead: 2015, isFavorite: false },
  { title: 'Ze Tian Ji',                                status: 'COMPLETED',  totalChapters: 1183, yearRead: 2015, isFavorite: false },
  { title: 'World of Cultivation',                      status: 'COMPLETED',  totalChapters: 915,  yearRead: 2015, isFavorite: false },
  { title: 'The Daily Life of the Immortal King',       status: 'COMPLETED',  totalChapters: 2177, yearRead: 2015, isFavorite: false },
  // 2024 group
  { title: 'God of Fishing',                            status: 'COMPLETED',  totalChapters: 3713, yearRead: 2024, isFavorite: false },
  { title: 'Oh My God! Earthlings are Insane!',         status: 'COMPLETED',  totalChapters: 1963, yearRead: 2024, isFavorite: false },
  { title: 'Eternal Sacred King',                       status: 'COMPLETED',  totalChapters: 3380, yearRead: 2024, isFavorite: true  },
  { title: 'War Sovereign Soaring The Heavens',         status: 'COMPLETED',  totalChapters: 4718, yearRead: 2024, isFavorite: false },
  // 2025 group
  { title: "The Novel's Extra",                         status: 'COMPLETED',  totalChapters: 380,  yearRead: 2025, isFavorite: false },
  { title: 'Invincible',                                status: 'COMPLETED',  totalChapters: 3753, yearRead: 2025, isFavorite: false },
  { title: 'Solo Farming In The Tower',                 status: 'COMPLETED',  totalChapters: 724,  yearRead: 2025, isFavorite: false },
  { title: "The Sovereign's Ascension",                 status: 'COMPLETED',  totalChapters: 2486, yearRead: 2025, isFavorite: false },
  { title: 'Necropolis Immortal',                       status: 'COMPLETED',  totalChapters: 2233, yearRead: 2025, isFavorite: false },
  { title: 'Lord of Mysteries',                         status: 'COMPLETED',  totalChapters: 1432, yearRead: 2025, isFavorite: false },
] as const

async function main() {
  console.log('Seeding database...')
  for (const book of books) {
    await prisma.book.create({
      data: {
        title: book.title,
        status: book.status,
        totalChapters: book.totalChapters,
        currentChapter: book.totalChapters,
        yearRead: book.yearRead ?? null,
        isFavorite: book.isFavorite,
        type: 'WEB_NOVEL',
      },
    })
  }
  console.log(`✓ Seeded ${books.length} books.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
