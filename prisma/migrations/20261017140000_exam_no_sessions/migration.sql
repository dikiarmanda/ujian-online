-- Development-friendly: drop session-era data, rebuild exam schedule schema.

-- 1. Clear dependent data
DELETE FROM `violation_logs`;
DELETE FROM `attempt_answers`;
DELETE FROM `exam_attempts`;
DELETE FROM `attendances`;
DELETE FROM `session_participants`;
DELETE FROM `exam_sessions`;
DELETE FROM `exam_questions`;
DELETE FROM `api_client_exams`;
DELETE FROM `exams`;

-- 2. Drop FKs that block table drops / alter
ALTER TABLE `attempt_answers` DROP FOREIGN KEY `attempt_answers_attemptId_fkey`;
ALTER TABLE `violation_logs` DROP FOREIGN KEY `violation_logs_attemptId_fkey`;
ALTER TABLE `exam_attempts` DROP FOREIGN KEY `exam_attempts_sessionId_fkey`;
ALTER TABLE `exam_attempts` DROP FOREIGN KEY `exam_attempts_userId_fkey`;
ALTER TABLE `attendances` DROP FOREIGN KEY `attendances_sessionId_fkey`;
ALTER TABLE `attendances` DROP FOREIGN KEY `attendances_userId_fkey`;
ALTER TABLE `session_participants` DROP FOREIGN KEY `session_participants_sessionId_fkey`;
ALTER TABLE `session_participants` DROP FOREIGN KEY `session_participants_userId_fkey`;
ALTER TABLE `exam_sessions` DROP FOREIGN KEY `exam_sessions_examId_fkey`;
ALTER TABLE `exam_questions` DROP FOREIGN KEY `exam_questions_examId_fkey`;
ALTER TABLE `exam_questions` DROP FOREIGN KEY `exam_questions_questionId_fkey`;
ALTER TABLE `exams` DROP FOREIGN KEY `exams_packageId_fkey`;

-- 3. Drop old tables
DROP TABLE `attendances`;
DROP TABLE `session_participants`;
DROP TABLE `exam_sessions`;
DROP TABLE `exam_questions`;
DROP TABLE `exam_attempts`;

-- 4. Alter exams
ALTER TABLE `exams` DROP INDEX `exams_examDate_idx`;
ALTER TABLE `exams` DROP INDEX `exams_packageId_idx`;
ALTER TABLE `exams` DROP COLUMN `examDate`;
ALTER TABLE `exams` DROP COLUMN `packageId`;

ALTER TABLE `exams`
  ADD COLUMN `competitionId` INT NOT NULL,
  ADD COLUMN `attendanceOpensAt` DATETIME(3) NOT NULL,
  ADD COLUMN `startsAt` DATETIME(3) NOT NULL,
  ADD COLUMN `endsAt` DATETIME(3) NOT NULL,
  ADD COLUMN `phase` ENUM('NOT_STARTED', 'RUNNING', 'ENDED') NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN `startedAt` DATETIME(3) NULL,
  ADD COLUMN `startedById` INT NULL,
  ADD COLUMN `endedAt` DATETIME(3) NULL,
  ADD COLUMN `endedById` INT NULL;

ALTER TABLE `exams` MODIFY `shuffleQuestions` BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE `exams` MODIFY `shuffleOptions` BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX `exams_competitionId_key` ON `exams`(`competitionId`);
CREATE INDEX `exams_phase_idx` ON `exams`(`phase`);
CREATE INDEX `exams_startsAt_idx` ON `exams`(`startsAt`);

ALTER TABLE `exams` ADD CONSTRAINT `exams_startedById_fkey` FOREIGN KEY (`startedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `exams` ADD CONSTRAINT `exams_endedById_fkey` FOREIGN KEY (`endedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Exam packages + snapshot questions
CREATE TABLE `exam_packages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `examId` INTEGER NOT NULL,
    `jenjang` VARCHAR(10) NOT NULL,
    `packageId` INTEGER NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `exam_packages_examId_jenjang_key` ON `exam_packages`(`examId`, `jenjang`);
CREATE INDEX `exam_packages_packageId_idx` ON `exam_packages`(`packageId`);
ALTER TABLE `exam_packages` ADD CONSTRAINT `exam_packages_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `exam_packages` ADD CONSTRAINT `exam_packages_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `question_packages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `exam_package_questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `examPackageId` INTEGER NOT NULL,
    `questionId` INTEGER NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `weight` DECIMAL(6, 2) NOT NULL,
    `wrongWeight` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `exam_package_questions_examPackageId_questionId_key` ON `exam_package_questions`(`examPackageId`, `questionId`);
CREATE UNIQUE INDEX `exam_package_questions_examPackageId_sortOrder_key` ON `exam_package_questions`(`examPackageId`, `sortOrder`);
CREATE INDEX `exam_package_questions_questionId_idx` ON `exam_package_questions`(`questionId`);
ALTER TABLE `exam_package_questions` ADD CONSTRAINT `exam_package_questions_examPackageId_fkey` FOREIGN KEY (`examPackageId`) REFERENCES `exam_packages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `exam_package_questions` ADD CONSTRAINT `exam_package_questions_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. New exam_attempts
CREATE TABLE `exam_attempts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `examId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `jenjang` VARCHAR(10) NOT NULL,
    `packageId` INTEGER NOT NULL,
    `attendedAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `extraSeconds` INTEGER NOT NULL DEFAULT 0,
    `submittedAt` DATETIME(3) NULL,
    `status` ENUM('IN_PROGRESS', 'SUBMITTED', 'TIME_EXPIRED') NOT NULL DEFAULT 'IN_PROGRESS',
    `questionOrder` JSON NULL,
    `optionOrder` JSON NULL,
    `lastQuestionIndex` INTEGER NOT NULL DEFAULT 0,
    `mcScore` DECIMAL(8, 2) NULL,
    `essayScore` DECIMAL(8, 2) NULL,
    `totalScore` DECIMAL(8, 2) NULL,
    `gradingStatus` ENUM('NOT_GRADED', 'PARTIAL', 'COMPLETED') NOT NULL DEFAULT 'NOT_GRADED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `exam_attempts_examId_userId_key` ON `exam_attempts`(`examId`, `userId`);
CREATE INDEX `exam_attempts_examId_status_idx` ON `exam_attempts`(`examId`, `status`);
CREATE INDEX `exam_attempts_examId_gradingStatus_idx` ON `exam_attempts`(`examId`, `gradingStatus`);
CREATE INDEX `exam_attempts_updatedAt_id_idx` ON `exam_attempts`(`updatedAt`, `id`);
ALTER TABLE `exam_attempts` ADD CONSTRAINT `exam_attempts_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `exams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `exam_attempts` ADD CONSTRAINT `exam_attempts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `attempt_answers` ADD CONSTRAINT `attempt_answers_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `exam_attempts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `violation_logs` ADD CONSTRAINT `violation_logs_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `exam_attempts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
