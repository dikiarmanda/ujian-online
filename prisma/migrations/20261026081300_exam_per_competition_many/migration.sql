-- DropIndex
DROP INDEX `exams_competitionId_key` ON `exams`;

-- CreateIndex
CREATE INDEX `exams_competitionId_idx` ON `exams`(`competitionId`);
