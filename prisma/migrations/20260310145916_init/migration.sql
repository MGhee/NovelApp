-- CreateTable
CREATE TABLE "Book" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "coverUrl" TEXT,
    "description" TEXT,
    "genre" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLAN_TO_READ',
    "type" TEXT NOT NULL DEFAULT 'WEB_NOVEL',
    "siteUrl" TEXT,
    "currentChapter" INTEGER NOT NULL DEFAULT 0,
    "currentChapterUrl" TEXT,
    "totalChapters" INTEGER NOT NULL DEFAULT 0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "yearRead" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" INTEGER NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "bookId" INTEGER NOT NULL,
    CONSTRAINT "Chapter_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Character" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "role" TEXT,
    "bookId" INTEGER NOT NULL,
    CONSTRAINT "Character_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomField" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "bookId" INTEGER NOT NULL,
    CONSTRAINT "CustomField_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Book_siteUrl_key" ON "Book"("siteUrl");
