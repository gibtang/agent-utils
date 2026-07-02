// agent-utils — Jenkins→Coolify. Mirrors anban/Jenkinsfile.
// Build args sourced from /run/secrets/build-env.agent-utils (gitignored on host).
// This app has no Mongo build-arg (no build-time prerender against Mongo).
// GitHub Actions (.github/workflows/deploy.yml) remains the fallback pipeline.
pipeline {
  agent any
  options { timestamps(); buildDiscarder(logRotator(numToKeepStr: '20')) }
  environment {
    IMAGE       = 'ghcr.io/gibtang/agent-utils'
    TAG         = "${BUILD_NUMBER}"
    APP_UUID    = 'yz21u33pxwy51638mq4fiytd'
    COOLIFY_API = 'https://coolify-api.feedcode.dev'
    BUILDENV    = '/run/secrets/build-env.agent-utils'
  }
  stages {
    stage('Checkout') { steps { checkout scm } }

    stage('Build Image') {
      steps {
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
        withCredentials([usernamePassword(credentialsId: 'ghcr-token', usernameVariable: 'GHCR_USER', passwordVariable: 'GHCR_PASS')]) {
          sh '''#!/bin/bash
            set -euo pipefail
            echo "${GHCR_PASS}" | docker login ghcr.io -u "${GHCR_USER}" --password-stdin
            docker push "${IMAGE}:${TAG}"
            docker push "${IMAGE}:latest"
          '''
        }
      }
    }

    stage('Deploy via Coolify') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'coolify-api', usernameVariable: 'CUSER', passwordVariable: 'CTOK')]) {
          sh '''#!/bin/bash
            set -euo pipefail
            code=$(curl -s -o /tmp/coolify.resp -w "%{http_code}" -X POST \
              "${COOLIFY_API}/api/v1/deploy" \
              -H "Authorization: Bearer ${CTOK}" \
              -H "Content-Type: application/json" \
              -d "{\"uuid\":\"${APP_UUID}\"}")
            cat /tmp/coolify.resp; echo
            [ "$code" = "200" ] || { echo "Coolify deploy failed (HTTP ${code})"; exit 1; }
            echo "Coolify deploy queued."
          '''
        }
      }
    }
  }
  post {
    cleanup { sh "docker image rm ${IMAGE}:${TAG} ${IMAGE}:latest 2>/dev/null || true" }
  }
}
