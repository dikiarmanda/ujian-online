-- AlterTable
ALTER TABLE `questions` ADD COLUMN `defaultWrongWeight` DECIMAL(6, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `exam_questions` ADD COLUMN `wrongWeight` DECIMAL(6, 2) NOT NULL DEFAULT 0;
