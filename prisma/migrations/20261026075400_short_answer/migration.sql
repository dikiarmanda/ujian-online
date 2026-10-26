-- AlterTable
ALTER TABLE `questions` MODIFY `type` ENUM('MULTIPLE_CHOICE', 'ESSAY', 'SHORT_ANSWER') NOT NULL;

-- CreateTable
CREATE TABLE `short_answer_keys` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `questionId` INTEGER NOT NULL,
    `answerKey` VARCHAR(500) NOT NULL,

    UNIQUE INDEX `short_answer_keys_questionId_key`(`questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `attempt_answers` ADD COLUMN `shortAnswerText` VARCHAR(500) NULL;

-- AddForeignKey
ALTER TABLE `short_answer_keys` ADD CONSTRAINT `short_answer_keys_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
