FROM gradle:9.5.1-jdk21 AS build
WORKDIR /app
COPY . .
RUN ./gradlew buildFatJar --no-daemon

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]