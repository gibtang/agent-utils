// agent-utils — Jenkins→Coolify. Mirrors anban/Jenkinsfile.
// Build args sourced from /run/secrets/build-env.agent-utils (gitignored on host).
// This app has no Mongo build-arg (no build-time prerender against Mongo).
// GitHub Actions (.github/workflows/deploy.yml) remains the fallback pipeline.
// tg() — Telegram pipeline notifications. TG_TOKEN/TG_CHAT come from Jenkins
// secret-text credentials; tg-notify.sh is mounted into the controller. No-ops
// silently if the creds are unset, so it never breaks a build.
void tg(String msg) {
  withEnv(["TG_MSG=${msg}"]) { sh 'tg-notify.sh' }
}

pipeline {
  agent any
  options { timestamps(); disableConcurrentBuilds(); buildDiscarder(logRotator(numToKeepStr: '20')) }
  // Poll the repo every minute; Jenkins builds only when new commits are
  // detected (not every poll). Prefer a GitHub webhook over polling if one is
  // wired up on the controller — this is a self-healing fallback for when no
  // webhook fires. Note: pollSCM schedules are only (re)loaded after the
  // pipeline runs once or the job config is saved in the Jenkins UI.
  triggers { cron('@hourly'); pollSCM('* * * * *') }
  environment {
    IMAGE       = 'ghcr.io/gibtang/agent-utils'
    TAG         = "${BUILD_NUMBER}"
    APP_UUID    = 'yz21u33pxwy51638mq4fiytd'
    COOLIFY_API = 'https://coolify-api.feedcode.dev'
    BUILDENV    = '/run/secrets/build-env.agent-utils'
    APP         = 'agent-utils'
    TG_TOKEN    = credentials('telegram-token')   // Telegram notify (tg-notify.sh)
    TG_CHAT     = credentials('telegram-chat')
  }
  stages {
    stage('Checkout') {
      steps {
        tg("🔨 <b>${APP}</b> #${BUILD_NUMBER} — Checkout started")
        checkout scm
      }
    }

    stage('Test') {
      steps {
        tg("🧪 <b>${APP}</b> #${BUILD_NUMBER} — Test started")
        // Run the vitest suite in a throwaway node:22 container before building
        // the image, so a test failure blocks the deploy. Uses bookworm-slim
        // (glibc) rather than alpine to avoid musl-binary issues with
        // mongodb-memory-server. The suite is self-contained — it spins up an
        // in-memory Mongo, so no external DB or secrets are needed.
        // .inside() maps the Jenkins uid so workspace files stay writable.
        script {
          docker.image('node:22-bookworm-slim').inside() {
            sh '''#!/bin/bash
              set -euo pipefail
              # --ignore-scripts skips husky's postinstall (fails with no .git).
              npm ci --ignore-scripts
              npm test
            '''
          }
        }
        tg("✅ <b>${APP}</b> #${BUILD_NUMBER} — Tests passed")
      }
    }

    stage('Build Image') {
      steps {
        tg("🔨 <b>${APP}</b> #${BUILD_NUMBER} — Build started")
        sh '''#!/bin/bash
          set -euo pipefail
          set -a; . "${BUILDENV}"; set +a
          docker build \
            --build-arg NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL}" \
            --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="${NEXT_PUBLIC_FIREBASE_API_KEY}" \
            --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}" \
            --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="${NEXT_PUBLIC_FIREBASE_PROJECT_ID}" \
            --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}" \
            --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}" \
            --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="${NEXT_PUBLIC_FIREBASE_APP_ID}" \
            --build-arg NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="${NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID}" \
            --build-arg NEXT_PUBLIC_GA_MEASUREMENT_ID="${NEXT_PUBLIC_GA_MEASUREMENT_ID}" \
            --build-arg NEXT_PUBLIC_POSTHOG_KEY="${NEXT_PUBLIC_POSTHOG_KEY}" \
            --build-arg NEXT_PUBLIC_POSTHOG_HOST="${NEXT_PUBLIC_POSTHOG_HOST}" \
            --build-arg NEXT_PUBLIC_BASE_URL="${NEXT_PUBLIC_BASE_URL}" \
            -t "${IMAGE}:${TAG}" -t "${IMAGE}:latest" .
        '''
      }
    }

    stage('Push to GHCR') {
      steps {
        tg("📤 <b>${APP}</b> #${BUILD_NUMBER} — Push to GHCR started")
        withCredentials([usernamePassword(credentialsId: 'ghcr-token', usernameVariable: 'GHCR_USER', passwordVariable: 'GHCR_PASS')]) {
          sh '''#!/bin/bash
            set -euo pipefail
            echo "${GHCR_PASS}" | docker login ghcr.io -u "${GHCR_USER}" --password-stdin
            docker push "${IMAGE}:${TAG}"
            docker push "${IMAGE}:latest"
          '''
        }
        tg("✅ <b>${APP}</b> #${BUILD_NUMBER} — Pushed to GHCR")
      }
    }

    stage('Deploy via Coolify') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'coolify-api', usernameVariable: 'CUSER', passwordVariable: 'CTOK')]) {
          sh """#!/bin/bash
            set -euo pipefail
            code=\$(curl -s -o /tmp/coolify.resp -w '%{http_code}' -X POST \\
              '${env.COOLIFY_API}/api/v1/deploy' \\
              -H "Authorization: Bearer \${CTOK}" \\
              -H 'Content-Type: application/json' \\
              -d '{"uuid":"${env.APP_UUID}"}')
            cat /tmp/coolify.resp; echo
            [ "\$code" = '200' ] || { echo "Coolify deploy failed (HTTP \${code})"; exit 1; }
            echo 'Coolify deploy queued.'
          """
        }
      }
    }
  }
  post {
    failure {
      tg("❌ <b>${APP}</b> #${BUILD_NUMBER} — build FAILED: ${env.BUILD_URL}")
    }
    cleanup { sh "docker image rm ${IMAGE}:${TAG} ${IMAGE}:latest 2>/dev/null || true" }
  }
}
