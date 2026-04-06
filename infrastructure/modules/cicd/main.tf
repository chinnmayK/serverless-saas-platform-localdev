resource "aws_codestarconnections_connection" "github" {
  name          = "${var.project_name}-github-connection"
  provider_type = "GitHub"
}

########################################################
# CODEBUILD PROJECT
########################################################

resource "aws_codebuild_project" "build" {
  name          = "${var.project_name}-build"
  service_role  = var.codebuild_role_arn

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                       = "aws/codebuild/standard:7.0"
    type                        = "LINUX_CONTAINER"
    privileged_mode             = true

    environment_variable {
      name  = "AWS_REGION"
      value = var.aws_region
    }

    environment_variable {
      name  = "PROJECT_NAME"
      value = var.project_name
    }
  }

  source {
    type      = "GITHUB"
    location  = "https://github.com/${var.github_repo}"
    buildspec = "buildspec.yml"
  }
}

########################################################
# S3 FOR PIPELINE ARTIFACTS
########################################################

resource "aws_s3_bucket" "pipeline_artifacts" {
  bucket = "${var.project_name}-pipeline-artifacts"
}

########################################################
# CODEPIPELINE
########################################################

resource "aws_codepipeline" "pipeline" {
  name     = "${var.project_name}-pipeline"
  role_arn = var.codepipeline_role_arn

  artifact_store {
    location = aws_s3_bucket.pipeline_artifacts.bucket
    type     = "S3"
  }

  ########################################################
  # SOURCE STAGE
  ########################################################
  stage {
    name = "Source"

    action {
      name             = "GitHub_Source"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeStarSourceConnection"
      version          = "1"
      output_artifacts = ["source_output"]

      configuration = {
        ConnectionArn    = aws_codestarconnections_connection.github.arn
        FullRepositoryId = var.github_repo
        BranchName       = "main"
      }
    }
  }

  ########################################################
  # BUILD STAGE
  ########################################################
  stage {
    name = "Build"

    action {
      name             = "Build"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      input_artifacts  = ["source_output"]
      output_artifacts = ["build_output"]
      version          = "1"

      configuration = {
        ProjectName = aws_codebuild_project.build.name
      }
    }
  }
}
