-- CreateTable
CREATE TABLE `question_packages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `description` VARCHAR(500) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `question_packages_name_key`(`name`),
    INDEX `question_packages_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question_package_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `packageId` INTEGER NOT NULL,
    `questionId` INTEGER NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `weight` DECIMAL(6, 2) NOT NULL,
    `wrongWeight` DECIMAL(6, 2) NOT NULL DEFAULT 0,

    INDEX `question_package_items_questionId_idx`(`questionId`),
    UNIQUE INDEX `question_package_items_packageId_questionId_key`(`packageId`, `questionId`),
    UNIQUE INDEX `question_package_items_packageId_sortOrder_key`(`packageId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `exams` ADD COLUMN `packageId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `exams_packageId_idx` ON `exams`(`packageId`);

-- AddForeignKey
ALTER TABLE `question_packages` ADD CONSTRAINT `question_packages_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_package_items` ADD CONSTRAINT `question_package_items_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `question_packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_package_items` ADD CONSTRAINT `question_package_items_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exams` ADD CONSTRAINT `exams_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `question_packages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
