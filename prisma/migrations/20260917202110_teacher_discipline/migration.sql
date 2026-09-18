-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "disciplineKey" TEXT;

-- CreateTable
CREATE TABLE "TeacherDiscipline" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherDiscipline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherDiscipline_teacherId_idx" ON "TeacherDiscipline"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherDiscipline_teacherId_key_key" ON "TeacherDiscipline"("teacherId", "key");

-- AddForeignKey
ALTER TABLE "TeacherDiscipline" ADD CONSTRAINT "TeacherDiscipline_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
